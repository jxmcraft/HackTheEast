/**
 * Avatar personality presets and helpers for the lesson tutor.
 * Used by TutorAvatar and chat-tutor to keep tone consistent with user preference.
 */

export type AvatarStyle = "strict" | "encouraging" | "socratic";

export const PERSONALITIES: Record<
  AvatarStyle,
  { greeting: string; feedback: string; encouragement: string; questioning: string }
> = {
  strict: {
    greeting: "Let's focus on the material. Today's topic is {topic}.",
    feedback: "Correct. Let's continue.",
    encouragement: "Adequate progress. Keep working.",
    questioning: "Explain your reasoning.",
  },
  encouraging: {
    greeting: "Hi there! I'm so excited to learn about {topic} with you!",
    feedback: "Great job! You're getting it!",
    encouragement: "Don't worry, you'll get there! Keep trying!",
    questioning: "What do you think? I'm curious to hear your thoughts!",
  },
  socratic: {
    greeting: "What do you already know about {topic}?",
    feedback: "Interesting perspective. Have you considered why?",
    encouragement: "Confusion is the beginning of wisdom.",
    questioning: "What makes you say that? What evidence do you have?",
  },
};

/**
 * Replaces template variables in a template string.
 */
function interpolate(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
}

/**
 * Returns the appropriate message based on personality type.
 * Supports template variables: {topic}, {studentName}, etc.
 */
export function getAvatarResponse(
  type: AvatarStyle,
  key: keyof (typeof PERSONALITIES)["strict"],
  params: Record<string, string> = {}
): string {
  const preset = PERSONALITIES[type] ?? PERSONALITIES.encouraging;
  const template = preset[key] ?? preset.greeting;
  return interpolate(template, params);
}

/**
 * Context for generating contextual avatar messages (e.g. after a lesson section).
 */
export type AvatarContext = {
  topic: string;
  studentName?: string;
  sectionSummary?: string;
  style: AvatarStyle;
};

/**
 * Returns a simple contextual greeting/summary message without calling an LLM.
 * For LLM-generated contextual messages, the chat-tutor endpoint handles that.
 */
export function getContextualGreeting(context: AvatarContext): string {
  return getAvatarResponse(context.style, "greeting", {
    topic: context.topic,
    studentName: context.studentName ?? "there",
  });
}
