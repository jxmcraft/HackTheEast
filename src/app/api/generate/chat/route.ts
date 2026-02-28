/**
 * StudyBuddy Chat API
 * Returns contextual AI replies based on user message, topic, section, and teaching style.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      message,
      topic = "Neural Networks",
      section = "",
      personalityPrompt = "be clear and helpful",
      sectionContent = "",
      uploadsContext = [],
    } = body as {
      message?: string;
      topic?: string;
      section?: string;
      personalityPrompt?: string;
      sectionContent?: string;
      uploadsContext?: Array<{ name: string; extracted_text?: string; key_points?: { pageNumber: number; points: string[] }[] }>;
    };

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          reply: `I'm your tutor for ${topic}. You asked: "${message.trim()}". Add MINIMAX_API_KEY to enable full AI replies. For now: try asking about neurons, activation functions, or backpropagation—I can give short answers on those!`,
        },
        { status: 200 }
      );
    }

    let uploadsBlock = "";
    if (Array.isArray(uploadsContext) && uploadsContext.length > 0) {
      const parts = uploadsContext.slice(0, 5).map((u) => {
        const text = (u.extracted_text || "").slice(0, 4000);
        const kp = (u.key_points || [])
          .map((p) => `Page ${p.pageNumber}: ${(p.points || []).join("; ")}`)
          .join("\n");
        return `Document "${u.name}":\n${text ? `Content:\n${text}\n` : ""}${kp ? `Key points:\n${kp}` : ""}`;
      });
      uploadsBlock = `\nThe student has uploaded these materials. Use them to inform your answer and refer to key points when relevant:\n\n${parts.join("\n\n---\n\n")}\n`;
    }

    const systemPrompt = `You are a friendly, knowledgeable AI tutor. Current topic: ${topic}. Current section: ${section}.
Teaching style you must follow: ${personalityPrompt}.

${sectionContent ? `Relevant content (use to inform your answer):\n${sectionContent.slice(0, 3000)}\n` : ""}${uploadsBlock}

Answer the student's question clearly and concisely. Use the teaching style above. When the student has uploaded materials, incorporate and highlight key points from those documents when they relate to the question. If the question is off-topic, briefly answer then gently steer back to ${topic}. Keep replies helpful and under 200 words unless the question needs more.`;

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
          { role: "user", content: message.trim() },
        ],
        temperature: 0.7,
        max_tokens: 512,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error("MiniMax chat error:", response.status, text);
      return NextResponse.json(
        {
          reply: `You asked: "${message.trim()}". I'm having a quick hiccup—please try again in a moment, or ask about ${topic} and I'll do my best!`,
        },
        { status: 200 }
      );
    }

    const data = JSON.parse(text);
    const reply =
      data.choices?.[0]?.message?.content?.trim() ||
      `Thanks for your question about "${message.trim().slice(0, 50)}...". Could you rephrase or ask something more specific about ${topic}?`;

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { reply: "Something went wrong on my side. Please try again!" },
      { status: 200 }
    );
  }
}
