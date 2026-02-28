/**
 * Text-mode lesson generator: bullet-point lessons with teaching style.
 */

import { chatCompletion } from "@/lib/ai/llm";
import type { RetrievedMaterial } from "@/lib/ai/retrieval";
import type { UserPreferences } from "@/lib/ai/types";

export type TextLessonSection = {
  title: string;
  bullets: string[];
  examples?: string[];
};

export type TextLesson = {
  introduction: string;
  sections: TextLessonSection[];
  takeaways: string[];
  /** Raw markdown for UI rendering */
  markdown: string;
};

const styleGuidance: Record<string, string> = {
  strict: "Be formal, precise, and expect high standards. Use clear definitions and avoid filler.",
  encouraging: "Be supportive, use positive reinforcement, and celebrate progress. Encourage the student.",
  socratic: "Ask guiding questions and lead the student to discover answers. Use Socratic method.",
};
void styleGuidance; // reserved for future use in prompt

export async function generateTextLesson(params: {
  topic: string;
  context: string;
  materials: RetrievedMaterial[];
  userPreferences: UserPreferences;
}): Promise<TextLesson> {
  const { topic, context, userPreferences } = params;

  const systemPrompt = `You are an expert tutor helping a student learn about: ${topic}

Your teaching style should be: ${userPreferences.avatar_style}
- If "strict": Be formal, precise, expect high standards.
- If "encouraging": Be supportive, use positive reinforcement, celebrate progress.
- If "socratic": Ask guiding questions, lead the student to discover answers.

Use the following course materials as your primary source:

${context}

Create a comprehensive lesson in bullet point format that:
1. Starts with a brief introduction to the topic
2. Covers 5-7 key concepts (each as a section with bullet points)
3. Includes practical examples where relevant
4. Ends with key takeaways

Return clean markdown. Use ## for section titles, - for bullets. Do not include a top-level title.`;

  const userPrompt = `Generate the lesson for: ${topic}. Teaching style: ${userPreferences.avatar_style}.`;

  let markdown: string;
  try {
    markdown = await chatCompletion({ system: systemPrompt, user: userPrompt, temperature: 0.6 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Lesson generation failed: ${msg}`);
  }

  const parsed = parseMarkdownToStructured(markdown);
  return { ...parsed, markdown };
}

/**
 * Parse markdown into introduction, sections, takeaways for optional structured display.
 */
function parseMarkdownToStructured(markdown: string): Omit<TextLesson, "markdown"> {
  const lines = markdown.split("\n");
  const introduction: string[] = [];
  const sections: TextLessonSection[] = [];
  const takeaways: string[] = [];
  let currentSection: TextLessonSection | null = null;
  let inTakeaways = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      if (currentSection) sections.push(currentSection);
      const title = h2[1].trim();
      if (/takeaway|summary|key point/i.test(title)) {
        inTakeaways = true;
        currentSection = null;
      } else {
        inTakeaways = false;
        currentSection = { title, bullets: [] };
      }
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      const text = bullet[1].trim();
      if (inTakeaways) {
        takeaways.push(text);
      } else if (currentSection) {
        currentSection.bullets.push(text);
      } else if (sections.length === 0 && !inTakeaways) {
        introduction.push(text);
      }
      continue;
    }
    if (line.trim() && !currentSection && introduction.length > 0 && sections.length === 0 && !inTakeaways) {
      introduction.push(line.trim());
    }
  }
  if (currentSection) sections.push(currentSection);

  return {
    introduction: introduction.join(" ").trim() || "Introduction to the topic.",
    sections,
    takeaways: takeaways.length > 0 ? takeaways : (sections.length ? ["Review the sections above."] : []),
  };
}
