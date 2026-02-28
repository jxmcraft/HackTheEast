/**
 * Phase 5: Memory & Context types
 */

export type MemoryType =
  | "concept_struggle"
  | "concept_mastered"
  | "learning_preference"
  | "topic_interest";

export type GeneratedMemory = {
  memoryType: MemoryType;
  content: string;
  importanceScore: number;
  sourceLessonId: string;
};

export type LessonForExtraction = {
  id: string;
  topic: string;
  contentSummary: string;
};

export type ChatMessageForExtraction = {
  role: "user" | "tutor";
  content: string;
};
