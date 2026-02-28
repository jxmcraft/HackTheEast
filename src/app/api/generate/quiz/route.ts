/**
 * Quiz Generation API
 * Generates one MCQ with hint via MiniMax LLM
 * Per PRD: POST /api/generate/quiz
 */

import { NextRequest, NextResponse } from "next/server";
import { getSectionById } from "@/lib/neuralNetworksContent";

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

// Fallback question when API is unavailable
function getFallbackQuiz(sectionId: string): QuizResponse {
  const fallbacks: Record<string, QuizResponse> = {
    intro: {
      question: "What is the mathematical formula for a neuron's output?",
      options: [
        "output = sum(inputs)",
        "output = activation(w1*x1 + w2*x2 + ... + bias)",
        "output = weights * inputs",
        "output = bias only",
      ],
      correctAnswer: "output = activation(w1*x1 + w2*x2 + ... + bias)",
      correctIndex: 1,
      hint: "Think about what happens to the weighted sum before it becomes the final output.",
      explanation:
        "A neuron multiplies each input by its weight, sums them with a bias, then passes the result through an activation function.",
    },
    network_architecture: {
      question: "Which layer receives raw data in a neural network?",
      options: ["Hidden Layer", "Output Layer", "Input Layer", "Activation Layer"],
      correctAnswer: "Input Layer",
      correctIndex: 2,
      hint: "Consider where data first enters the network.",
      explanation: "The input layer receives raw data; the number of neurons equals the number of features.",
    },
    backpropagation: {
      question: "What does backpropagation use to compute gradients?",
      options: ["Forward pass", "Chain rule", "Activation function", "Loss only"],
      correctAnswer: "Chain rule",
      correctIndex: 1,
      hint: "It's a calculus technique for computing derivatives of composite functions.",
      explanation: "Backpropagation uses the chain rule to compute gradients of the loss with respect to each weight.",
    },
    training: {
      question: "What is one complete pass through the training data called?",
      options: ["Batch", "Iteration", "Epoch", "Step"],
      correctAnswer: "Epoch",
      correctIndex: 2,
      hint: "Think about how many times the model sees the full dataset.",
      explanation: "An epoch is one complete pass through the entire training dataset.",
    },
  };
  return (
    fallbacks[sectionId] ||
    fallbacks.intro
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sectionId,
      sectionContent,
      topic = "Neural Networks Basics",
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
      // Return fallback when no API key
      const fallback = getFallbackQuiz(sectionId);
      return NextResponse.json(fallback);
    }

    const content =
      sectionContent ||
      getSectionById(sectionId)?.content ||
      "Neural networks basics including neurons, layers, and training.";

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
