/**
 * Practice Question Component
 * Per PRD Feature 5: Practice Question (On Demand)
 * Single MCQ with hint, submit, and feedback
 */

"use client";

import React, { useState } from "react";
import { HelpCircle, CheckCircle, XCircle } from "lucide-react";
import { recordPracticeResult, addStruggle } from "@/lib/studybuddyStorage";

export interface QuizData {
  question: string;
  options: string[];
  correctAnswer: string;
  correctIndex: number;
  hint: string;
  explanation: string;
}

interface PracticeQuestionProps {
  sectionId: string;
  sectionTitle: string;
  personalityPrompt: string;
  sectionContent?: string;
  topic?: string;
  onClose?: () => void;
}

const OPTION_LETTERS = ["A", "B", "C", "D"];

export default function PracticeQuestion({
  sectionId,
  sectionTitle,
  personalityPrompt,
  sectionContent,
  topic = "Neural Networks Basics",
  onClose,
}: PracticeQuestionProps) {
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const fetchQuiz = async () => {
    setIsLoading(true);
    setQuiz(null);
    setSelectedIndex(null);
    setShowHint(false);
    setSubmitted(false);
    try {
      const res = await fetch("/api/generate/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId,
          sectionContent,
          topic,
          personalityPrompt,
        }),
      });
      const data = await res.json();
      setQuiz(data);
    } catch (err) {
      console.error("Failed to fetch quiz:", err);
      setQuiz({
        question: "What is the main concept from this section?",
        options: [
          "A) Review the content above",
          "B) Check the key terms",
          "C) Understand the main idea",
          "D) All of the above",
        ],
        correctAnswer: "D) All of the above",
        correctIndex: 3,
        hint: "Re-read the section summary.",
        explanation: "Make sure you understand the key concepts before moving on.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!quiz || selectedIndex === null) return;
    setSubmitted(true);
    const correct = selectedIndex === quiz.correctIndex;
    setIsCorrect(correct);

    const userAnswer = quiz.options[selectedIndex] || "";
    recordPracticeResult({
      sectionId,
      question: quiz.question,
      userAnswer,
      correctAnswer: quiz.correctAnswer,
      isCorrect: correct,
      timestamp: Date.now(),
    });

    if (!correct) {
      addStruggle(sectionId);
    }
  };

  if (!quiz && !isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Practice: {sectionTitle}
        </h3>
        <p className="text-gray-600 mb-4">
          Test your understanding with a quick quiz. One question will be generated based on this section.
        </p>
        <div className="flex gap-3">
          <button
            onClick={fetchQuiz}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            Generate Practice Question
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-3">Powered by MiniMax abab6.5</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Generating your practice question...</p>
        </div>
      </div>
    );
  }

  if (!quiz) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{quiz.question}</h3>

      <div className="space-y-2 mb-4">
        {quiz.options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => !submitted && setSelectedIndex(idx)}
            disabled={submitted}
            className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors text-gray-900 ${
              submitted
                ? idx === quiz.correctIndex
                  ? "border-green-500 bg-green-50"
                  : selectedIndex === idx
                    ? "border-red-500 bg-red-50"
                    : "border-gray-200 bg-gray-50"
                : selectedIndex === idx
                  ? "border-purple-600 bg-purple-50"
                  : "border-gray-200 hover:border-purple-300"
            }`}
          >
            <span className="font-medium">{OPTION_LETTERS[idx]}.</span> {opt}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {!showHint && !submitted && (
          <button
            onClick={() => setShowHint(true)}
            className="flex items-center gap-2 px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-sm font-medium"
          >
            <HelpCircle className="w-4 h-4" />
            Get Hint
          </button>
        )}
        {showHint && (
          <div className="w-full p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
            💡 {quiz.hint}
          </div>
        )}
      </div>

      {!submitted ? (
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={selectedIndex === null}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            Submit
          </button>
          <button
            onClick={fetchQuiz}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg"
          >
            New Question
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Close
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={`flex items-center gap-2 p-3 rounded-lg ${
              isCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {isCorrect ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="font-medium">
              {isCorrect ? "Correct! 🎉" : "Not quite. Here's the explanation:"}
            </span>
          </div>
          <p className="text-gray-700 text-sm">{quiz.explanation}</p>
          <div className="flex gap-2">
            <button
              onClick={fetchQuiz}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg"
            >
              Try Another Question
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-600 mt-3">Powered by MiniMax abab6.5</p>
    </div>
  );
}
