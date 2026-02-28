/**
 * Extract important dates and times from course material text and return
 * calendar-friendly events. Used to populate the calendar from syllabi,
 * announcements, and other documents.
 *
 * Screening rules:
 * - Only add events that look important (exam, midterm, due date, deadline, etc.).
 * - Do not add lesson time (class, lecture, lab schedules).
 * - TA courses: calendar extraction is skipped in sync (see sync route).
 * - Keep the list short: only high-value academic dates (exams, deadlines, drop dates).
 */

import * as chrono from "chrono-node";

const MAX_TEXT_LENGTH = 50_000;
const SNIPPET_RADIUS = 80;
const MAX_EVENTS_PER_MATERIAL = 8;
const REF_DATE = new Date();

/** Only these phrases qualify for the calendar (exams, deadlines, drop dates). No lesson time, no generic meetings. */
const IMPORTANT_KEYWORDS = [
  "exam", "midterm", "final", "quiz", "test",
  "due", "deadline", "submission", "assignments?",
  "drop date", "withdraw",
];
const IMPORTANT_REGEX = new RegExp(
  "\\b(" + IMPORTANT_KEYWORDS.join("|") + ")\\b",
  "i"
);

/** Phrases that suggest a date is noise (copyright, published, etc.). */
const NOISE_KEYWORDS = [
  "published", "copyright", "©", "last updated", "revised",
  "created", "printed", "edition",
];
const NOISE_REGEX = new RegExp(
  "\\b(" + NOISE_KEYWORDS.join("|") + ")\\b",
  "i"
);

/**
 * Return true if the snippet looks like an important calendar event (exam, due date, etc.),
 * and false if it looks like noise (copyright, published date, etc.).
 */
function isImportantSnippet(snippet: string): boolean {
  if (!snippet || snippet.length < 3) return false;
  const normalized = snippet.replace(/\s+/g, " ").trim();
  if (NOISE_REGEX.test(normalized)) return false;
  return IMPORTANT_REGEX.test(normalized);
}

export type ExtractedEvent = {
  title: string;
  startAt: string;
  endAt?: string;
  allDay: boolean;
  snippet: string;
};

/**
 * Derive a short title from the text surrounding a parsed date.
 * Uses the phrase that contains the date, trimmed and truncated.
 */
function titleFromSnippet(fullText: string, index: number, dateText: string): string {
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(fullText.length, index + dateText.length + SNIPPET_RADIUS);
  let snippet = fullText.slice(start, end).replace(/\s+/g, " ").trim();
  if (snippet.length > 120) {
    const i = snippet.indexOf(dateText);
    if (i >= 0) {
      const before = snippet.slice(Math.max(0, i - 40), i).trim();
      const after = snippet.slice(i + dateText.length, i + dateText.length + 40).trim();
      snippet = [before, dateText, after].filter(Boolean).join(" ");
    }
    if (snippet.length > 120) snippet = snippet.slice(0, 117) + "...";
  }
  const cleaned = snippet
    .replace(/^\s*(due|deadline|exam|quiz|test|assignment|class|lecture|office hours|meeting|submission)\s*[:\-–—]\s*/i, "")
    .trim();
  const firstSentence = cleaned.split(/[.!?\n]/)[0]?.trim() ?? cleaned;
  if (firstSentence.length > 100) return firstSentence.slice(0, 97) + "...";
  return firstSentence || dateText;
}

/**
 * Check if the parsed date is in a reasonable range (e.g. course semester).
 * Default: from 1 year ago to 2 years from now.
 */
function isInReasonableRange(d: Date): boolean {
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  const twoYearsLater = new Date(now);
  twoYearsLater.setFullYear(now.getFullYear() + 2);
  return d >= oneYearAgo && d <= twoYearsLater;
}

/**
 * Extract calendar events from a single material's text.
 * Uses chrono-node to find dates; builds title from surrounding snippet.
 */
export function extractDatesFromText(
  contentText: string,
  _materialTitle?: string
): ExtractedEvent[] {
  if (!contentText || typeof contentText !== "string") return [];
  const text = contentText.slice(0, MAX_TEXT_LENGTH);
  const results = chrono.parse(text, REF_DATE, { forwardDate: true });
  const seen = new Set<string>();
  const events: ExtractedEvent[] = [];

  for (const result of results.slice(0, MAX_EVENTS_PER_MATERIAL)) {
    const startDate = result.start.date();
    if (!isInReasonableRange(startDate)) continue;

    const dateKey = startDate.toISOString().slice(0, 16);
    if (seen.has(dateKey)) continue;
    seen.add(dateKey);

    const endDate = result.end?.date();
    const hour = result.start.get("hour");
    const hasTime = hour != null && (result.end != null || hour !== 0);
    const title = titleFromSnippet(text, result.index, result.text);
    const snippet = text.slice(Math.max(0, result.index - 60), result.index + result.text.length + 60)
      .replace(/\s+/g, " ")
      .trim();

    if (!isImportantSnippet(snippet) && !isImportantSnippet(title)) continue;

    events.push({
      title: title || result.text || "Event",
      startAt: startDate.toISOString(),
      endAt: endDate ? endDate.toISOString() : undefined,
      allDay: !hasTime,
      snippet: snippet.slice(0, 500),
    });
  }

  return events;
}
