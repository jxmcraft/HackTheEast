/**
 * Lesson quiz: generate 2 MCQs from lesson content via MiniMax (no OpenAI).
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type QuizItem = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const topic = (body.topic as string)?.trim() || "this lesson";
    const lessonContent = (body.lessonContent as string)?.trim()?.slice(0, 4000) || "";

    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        questions: [
          {
            question: `What is the main takeaway about ${topic}?`,
            options: ["I need to review the lesson", "I understand the basics", "I can explain it to others", "I'm not sure yet"],
            correctIndex: 2,
            explanation: "Review the lesson to reinforce the main ideas.",
          },
        ],
      });
    }

    const systemPrompt = `You are a tutor. Generate exactly 2 multiple-choice questions to check understanding of the lesson.
Topic: ${topic}
${lessonContent ? `Lesson content (use to create questions):\n${lessonContent}` : "Create general comprehension questions."}

Respond with ONLY a JSON array of exactly 2 objects. Each object: {"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"correctIndex":0,"explanation":"..."}
correctIndex is 0-3. No markdown, no code fence.`;

    const res = await fetch("https://api.minimax.io/v1/text/chatcompletion_v2", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "M2-her",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Generate the 2 quiz questions as JSON array." }],
        temperature: 0.6,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("MiniMax lesson-quiz error:", res.status, err);
      return NextResponse.json({
        questions: [
          { question: `What did you learn about ${topic}?`, options: ["A lot", "Some", "A little", "Need to review"], correctIndex: 0, explanation: "Review the lesson." },
        ],
      });
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data?.choices?.[0]?.message?.content?.trim() ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : "[]";
    let parsed: QuizItem[];
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = [];
    }
    const questions = (Array.isArray(parsed) ? parsed : []).slice(0, 2).map((q) => ({
      question: q.question ?? "?",
      options: Array.isArray(q.options) ? q.options : ["A", "B", "C", "D"],
      correctIndex: Math.min(3, Math.max(0, Number(q.correctIndex) || 0)),
      explanation: q.explanation ?? "",
    }));

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("lesson-quiz error:", err);
    return NextResponse.json({ questions: [] }, { status: 500 });
  }
}
