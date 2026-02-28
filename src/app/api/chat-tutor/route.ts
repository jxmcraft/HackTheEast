/**
 * Lesson Q&A API: follow-up questions with lesson context.
 * Uses MiniMax first; falls back to Featherless only if MiniMax is unavailable.
 * No OpenAI.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";
import { PERSONALITIES, type AvatarStyle } from "@/lib/avatar/personality";
import { getContextualMemories, formatMemoriesForPrompt } from "@/lib/memory/context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatMessage = { role: "user" | "tutor"; content: string };

type Body = {
  lessonId?: string | null;
  question: string;
  chatHistory?: ChatMessage[];
  topic?: string;
  lessonContent?: string;
  avatarStyle?: AvatarStyle;
};

function getTeachingStylePrompt(style: AvatarStyle): string {
  const p = PERSONALITIES[style] ?? PERSONALITIES.encouraging;
  return [
    `Greeting style: ${p.greeting}`,
    `Feedback style: ${p.feedback}`,
    `Encouragement: ${p.encouragement}`,
    `Questioning: ${p.questioning}`,
  ].join(" ");
}

async function callMiniMax(
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string | null> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return null;
  const res = await fetch("https://api.minimax.io/v1/text/chatcompletion_v2", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "M2-her",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens: 600,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content?.trim();
  return typeof content === "string" ? content : null;
}

async function callFeatherless(
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string | null> {
  const apiKey = process.env.FEATHERLESS_API_KEY;
  if (!apiKey) return null;
  const base = (process.env.FEATHERLESS_API_BASE ?? "https://api.featherless.ai").replace(/\/$/, "");
  const model = process.env.FEATHERLESS_CHAT_MODEL ?? "Qwen/Qwen2.5-7B-Instruct";
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(base.includes("featherless") && {
        HTTP_Referer: process.env.NEXT_PUBLIC_APP_URL ?? "",
        "X-Title": "HTE Study Companion",
      }),
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 600,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content?.trim();
  return typeof content === "string" ? content : null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClientOrThrow();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get("lessonId");
    if (!lessonId) return NextResponse.json({ error: "lessonId required" }, { status: 400 });
    const { data, error } = await supabase
      .from("lesson_chat")
      .select("id, role, content, created_at")
      .eq("lesson_id", lessonId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const history = (data ?? []).map((r) => ({ role: r.role as "user" | "tutor", content: r.content }));
    return NextResponse.json({ success: true, history });
  } catch (err) {
    console.error("chat-tutor GET error:", err);
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClientOrThrow();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as Body;
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const chatHistory = Array.isArray(body.chatHistory) ? body.chatHistory : [];
    const avatarStyle: AvatarStyle = ["strict", "encouraging", "socratic"].includes(body.avatarStyle ?? "")
      ? (body.avatarStyle as AvatarStyle)
      : "encouraging";

    let topic = typeof body.topic === "string" ? body.topic.trim() : "";
    let lessonContent = typeof body.lessonContent === "string" ? body.lessonContent.trim() : "";
    let lessonId: string | null = typeof body.lessonId === "string" ? body.lessonId : null;

    if (lessonId) {
      const { data: lesson } = await supabase
        .from("lessons")
        .select("id, topic, content")
        .eq("id", lessonId)
        .eq("user_id", user.id)
        .single();
      if (lesson) {
        topic = topic || String(lesson.topic ?? "");
        if (!lessonContent && lesson.content) {
          const c = lesson.content as Record<string, unknown>;
          if (typeof c?.markdown === "string") lessonContent = c.markdown.slice(0, 8000);
          else if (Array.isArray(c?.slides))
            lessonContent = (c.slides as { title?: string; bullets?: string[] }[])
              .map((s) => `${s.title ?? ""}\n${(s.bullets ?? []).join("\n")}`)
              .join("\n\n")
              .slice(0, 8000);
          else if (Array.isArray(c?.script))
            lessonContent = (c.script as { text?: string }[]).map((s) => s.text ?? "").join(" ").slice(0, 8000);
        }
      } else {
        lessonId = null;
      }
    }

    if (!topic) topic = "this lesson";

    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("avatar_style")
      .eq("id", user.id)
      .single();
    const style: AvatarStyle = (prefs?.avatar_style as AvatarStyle) ?? avatarStyle;
    const teachingStyle = getTeachingStylePrompt(style);

    const memories = await getContextualMemories(supabase, user.id, 5);
    const memoryBlock = memories.length > 0 ? `\n${formatMemoriesForPrompt(memories)}\n\n` : "";

    const systemPrompt = `You are a helpful tutor. The student is learning about ${topic}.
${memoryBlock}
Teaching style: ${teachingStyle}

Guidelines:
- Answer based on the lesson material when provided
- If unsure, say so honestly
- Keep answers concise but thorough
- Use examples when helpful
- Reference the lesson when relevant
- Ask a short follow-up question to check understanding when appropriate
${lessonContent ? `\nLesson content (use to inform your answer):\n${lessonContent.slice(0, 6000)}` : ""}`;

    const messages: { role: string; content: string }[] = [
      ...chatHistory.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: question },
    ];

    let answer = await callMiniMax(systemPrompt, messages);
    if (answer == null) answer = await callFeatherless(systemPrompt, messages);
    if (answer == null) {
      return NextResponse.json({
        success: false,
        error: "No AI provider available. Set MINIMAX_API_KEY or FEATHERLESS_API_KEY.",
        answer: `You asked: "${question.slice(0, 80)}...". Add MINIMAX_API_KEY or FEATHERLESS_API_KEY to get AI answers.`,
      });
    }

    if (lessonId) {
      await supabase.from("lesson_chat").insert([
        { lesson_id: lessonId, user_id: user.id, role: "user", content: question },
        { lesson_id: lessonId, user_id: user.id, role: "tutor", content: answer },
      ]);
    }

    const suggestedFollowUp: string[] = [];
    if (answer.length > 50 && !answer.endsWith("?")) {
      suggestedFollowUp.push("Can you give an example?");
      suggestedFollowUp.push("How does this relate to the main topic?");
    }

    return NextResponse.json({
      success: true,
      answer,
      sources: [],
      suggestedFollowUp,
    });
  } catch (err) {
    console.error("chat-tutor error:", err);
    return NextResponse.json(
      { success: false, error: "Something went wrong", answer: "Please try again in a moment." },
      { status: 500 }
    );
  }
}
