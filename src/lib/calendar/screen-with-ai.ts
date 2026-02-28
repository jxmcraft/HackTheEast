/**
 * Use the AI to screen which extracted dates should go on the calendar.
 * When an LLM API key is set, asks the model to keep only high-value academic dates.
 * When not set, falls back to a strict keyword filter.
 */

import { chatCompletion } from "@/lib/ai/llm";
import type { ExtractedEvent } from "./date-extractor";

const BATCH_SIZE = 15;
const STRICT_KEYWORDS = /\b(exam|midterm|final|quiz|test|due|deadline|submission|assignment|drop\s*date|withdraw)\b/i;

export type CalendarCandidate = { ev: ExtractedEvent; source_canvas_item_id: string };

function hasStrictKeyword(snippet: string, title: string): boolean {
  const text = `${snippet} ${title}`;
  return STRICT_KEYWORDS.test(text.replace(/\s+/g, " "));
}

/**
 * Screen candidates: return only those the AI (or strict filter) says belong on the calendar.
 * INCLUDE: exam, midterm, final, assignment due date, drop/withdraw deadline.
 * EXCLUDE: office hours, generic meetings, class schedule, publication dates, vague/TBD.
 */
export async function screenCalendarCandidates(
  candidates: CalendarCandidate[]
): Promise<CalendarCandidate[]> {
  if (candidates.length === 0) return [];

  const hasLLM =
    typeof process !== "undefined" &&
    (process.env.FEATHERLESS_API_KEY || process.env.OPENAI_API_KEY);

  if (!hasLLM) {
    return candidates.filter((c) => hasStrictKeyword(c.ev.snippet, c.ev.title));
  }

  const results: CalendarCandidate[] = [];
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const listText = batch
      .map(
        (c, j) =>
          `[${j}] ${c.ev.title} | ${c.ev.snippet.slice(0, 120)}${c.ev.snippet.length > 120 ? "..." : ""}`
      )
      .join("\n");

    try {
      const reply = await chatCompletion({
        system: `You decide which items belong on a student's academic calendar.
INCLUDE only: exam, midterm, final exam, quiz, test, assignment/project due date, submission deadline, drop date, withdraw deadline.
EXCLUDE: office hours, generic meetings, class/lecture schedule, publication/copyright dates, vague or TBD dates, "no class", holidays (unless it's a deadline).
Reply with a single line: comma-separated 0-based indices to KEEP (e.g. 0,2,5). Reply NONE if no items in the list are calendar-worthy.`,
        user: `List (indices 0-${batch.length - 1}):\n${listText}\n\nWhich indices should go on the calendar?`,
        temperature: 0.2,
      });

      const line = (reply || "").trim().toUpperCase();
      if (line === "NONE" || line.includes("NONE")) continue;

      const indices = new Set(
        line
          .replace(/[^\d,]/g, ",")
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isInteger(n) && n >= 0 && n < batch.length)
      );
      for (const idx of Array.from(indices)) {
        results.push(batch[idx]);
      }
    } catch {
      for (const c of batch) {
        if (hasStrictKeyword(c.ev.snippet, c.ev.title)) results.push(c);
      }
    }
  }
  return results;
}
