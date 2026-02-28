/**
 * Shared types for AI lesson generation.
 */

export type AvatarStyle = "strict" | "encouraging" | "socratic";
export type LearningMode = "text" | "audio" | "slides";

export type UserPreferences = {
  learning_mode: LearningMode;
  avatar_style: AvatarStyle;
  avatar_name?: string | null;
};
