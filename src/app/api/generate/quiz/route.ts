/**
 * Quiz Generation API
 * Generates one MCQ with hint via MiniMax LLM
 * Per PRD: POST /api/generate/quiz
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface QuizResponse {
  question: string;
  options: string[];
  correctAnswer: string;
  correctIndex: number;
  hint: string;
  explanation: string;
}

// Generic fallback question when API is unavailable
function getFallbackQuiz(): QuizResponse {
  return {
    question: "What is the best way to check that you understand a topic?",
    options: [
      "Skip to the next section",
      "Explain it in your own words or teach someone else",
      "Read the material once",
      "Memorize definitions only",
    ],
    correctAnswer: "Explain it in your own words or teach someone else",
    correctIndex: 1,
    hint: "Active recall and teaching help solidify understanding.",
    explanation: "Explaining in your own words or teaching someone else tests and strengthens your understanding.",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sectionId,
      sectionContent,
      topic = "this topic",
      personalityPrompt = "be clear and helpful",
    } = body;

    if (!sectionId) {
      return NextResponse.json(
        { error: "sectionId is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      return NextResponse.json(getFallbackQuiz());
    }

    const content =
      sectionContent ||
      "General study content. Generate a quiz that tests understanding of key concepts.";

    const systemPrompt = `You are a university tutor creating a multiple-choice quiz. Teaching style: ${personalityPrompt}.

Generate exactly ONE multiple-choice question (4 options: A, B, C, D) based on this content. The question should test understanding.

Respond with ONLY valid JSON in this exact format (no markdown, no extra text):
{"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"correctIndex":0,"hint":"...","explanation":"..."}
correctIndex is 0-3 for A/B/C/D.`;

    const userPrompt = `Topic: ${topic}\n\nContent:\n${content.slice(0, 2000)}\n\nGenerate the quiz JSON:`;

    const response = await fetch("https://api.minimax.io/v1/text/chatcompletion_v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "M2-her",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("MiniMax API error:", response.status, errText);
      const fallback = getFallbackQuiz(sectionId);
      return NextResponse.json(fallback);
    }

    const data = await response.json();
    const text =
      data.choices?.[0]?.message?.content?.trim() || "";

    // Parse JSON from response (handle markdown code blocks)
    let parsed: Partial<QuizResponse>;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      parsed = JSON.parse(jsonStr);
    } catch {
      const fallback = getFallbackQuiz(sectionId);
      return NextResponse.json(fallback);
    }

    const result: QuizResponse = {
      question: parsed.question || "What did you learn from this section?",
      options: Array.isArray(parsed.options)
        ? parsed.options
        : ["A", "B", "C", "D"],
      correctAnswer:
        parsed.options?.[parsed.correctIndex ?? 0] || parsed.options?.[0] || "",
      correctIndex: Math.min(
        Math.max(0, parsed.correctIndex ?? 0),
        (parsed.options?.length ?? 4) - 1
      ),
      hint: parsed.hint || "Review the key concepts.",
      explanation: parsed.explanation || "Check the section content for details.",
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Quiz API error:", error);
    const fallback = getFallbackQuiz("intro");
    return NextResponse.json(fallback);
  }
}
