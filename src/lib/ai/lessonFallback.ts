/**
 * Tiered fallback for lesson generation when course materials are missing or low relevance.
 */

import { retrieveRelevantMaterials, prepareContextForLLM, getCourseUuid } from "@/lib/ai/retrieval";
import { searchWebForTopic, augmentWithWebContent } from "@/lib/ai/searchFallback";
import { generateTextLesson } from "@/lib/ai/generators/textGenerator";
import { generateSlidesLesson } from "@/lib/ai/generators/slidesGenerator";
import { generateAudioLesson } from "@/lib/ai/generators/audioGenerator";
import type { UserPreferences } from "@/lib/ai/types";
import type { LearningMode } from "@/lib/ai/types";
import type { RetrievedMaterial } from "@/lib/ai/retrieval";

const SIMILARITY_STRONG = 0.7;
const SIMILARITY_PARTIAL = 0.4;

const GENERAL_KNOWLEDGE_CONTEXT = `No course materials were found for this topic.

Use your general academic knowledge to teach this topic. Be accurate and educationally sound. Use standard academic explanations and examples from common textbooks where relevant.

IMPORTANT: Do not make up course-specific details, assignment requirements, or professor policies.
Start your response with exactly: "Note: No specific course materials were found. This lesson uses general academic knowledge."`;

export type FallbackUsed = "none" | "partial" | "general" | "web_search" | "user_context";

export type Source = { title?: string; url?: string; relevance?: number };

export type FallbackParams = {
  topic: string;
  courseId: string;
  userId: string;
  contextHint?: string;
  mode: LearningMode;
  preferences: UserPreferences;
};

export type FallbackResult = {
  success: boolean;
  content: unknown;
  sources: Source[];
  fallbackUsed: FallbackUsed;
  disclaimer?: string;
  retrievalScore?: number;
  sourceCount?: number;
};

function buildSourcesFromMaterials(materials: RetrievedMaterial[]): Source[] {
  return materials.map((m) => ({
    title: (m.metadata?.title as string) ?? m.metadata?.content_type ?? "Source",
    url: m.metadata?.url as string | undefined,
    relevance: m.similarity,
  }));
}

export async function generateLessonWithFallback(params: FallbackParams): Promise<FallbackResult> {
  const { topic, courseId, userId, contextHint, mode, preferences } = params;
  const queryTopic = contextHint ? `${topic}. ${contextHint}` : topic;

  const materials = await retrieveRelevantMaterials({
    courseId,
    topic: queryTopic,
    limit: 10,
    userId,
  });

  const topScore = materials.length > 0 ? materials[0].similarity : 0;

  // Tier 0: Strong match — use materials as-is
  if (materials.length > 0 && topScore >= SIMILARITY_STRONG) {
    const preparedContext = prepareContextForLLM(materials);
    const sources = buildSourcesFromMaterials(materials);
    const content = await generateByMode(mode, topic, preparedContext, materials, preferences);
    return {
      success: true,
      content,
      sources,
      fallbackUsed: "none",
      retrievalScore: topScore,
      sourceCount: materials.length,
    };
  }

  // Partial match (0.4–0.7): use materials with disclaimer
  if (materials.length > 0 && topScore >= SIMILARITY_PARTIAL) {
    const preparedContext = prepareContextForLLM(materials);
    const sources = buildSourcesFromMaterials(materials);
    const content = await generateByMode(mode, topic, preparedContext, materials, preferences);
    return {
      success: true,
      content,
      sources,
      fallbackUsed: "partial",
      disclaimer: "Partial match found. Lesson may be augmented with general knowledge.",
      retrievalScore: topScore,
      sourceCount: materials.length,
    };
  }

  // Tier 2: Try web search (optional)
  const webResults = await searchWebForTopic(topic);
  if (webResults && webResults.length > 0) {
    const webContext = webResults
      .map((r) => `--- ${r.title} (${r.url}) ---\n${r.snippet ?? ""}`)
      .join("\n\n")
      .slice(0, 8000);
    const combinedContext = materials.length > 0
      ? augmentWithWebContent(prepareContextForLLM(materials), webContext)
      : webContext;
    const materialsFromWeb: RetrievedMaterial[] = webResults.map((r, i) => ({
      id: `web-${i}`,
      content_text: r.snippet ?? r.title,
      metadata: { title: r.title, url: r.url },
      similarity: r.relevance ?? 0.7,
    }));
    const content = await generateByMode(mode, topic, combinedContext, materialsFromWeb, preferences);
    const sources: Source[] = webResults.map((r) => ({ title: r.title, url: r.url, relevance: r.relevance }));
    return {
      success: true,
      content,
      sources,
      fallbackUsed: "web_search",
      disclaimer: "Course materials not found. Some content from web sources. Verify with your course materials.",
      retrievalScore: topScore,
      sourceCount: sources.length,
    };
  }

  // Tier 1: General knowledge
  const content = await generateByMode(mode, topic, GENERAL_KNOWLEDGE_CONTEXT, [], preferences);
  return {
    success: true,
    content,
    sources: [],
    fallbackUsed: "general",
    disclaimer: "No course materials found. This lesson uses general academic knowledge.",
    retrievalScore: topScore,
    sourceCount: 0,
  };
}

async function generateByMode(
  mode: LearningMode,
  topic: string,
  context: string,
  materials: RetrievedMaterial[],
  preferences: UserPreferences
): Promise<unknown> {
  if (mode === "text") {
    return generateTextLesson({ topic, context, materials, userPreferences: preferences });
  }
  if (mode === "slides") {
    return generateSlidesLesson({ topic, context, materials, userPreferences: preferences });
  }
  return generateAudioLesson({ topic, context, materials, userPreferences: preferences });
}

export { getCourseUuid };
