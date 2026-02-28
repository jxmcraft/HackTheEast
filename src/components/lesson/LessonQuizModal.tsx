"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";

type QuizItem = { question: string; options: string[]; correctIndex: number; explanation: string };

type LessonQuizModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: string;
  lessonContentExcerpt: string;
};

export function LessonQuizModal({
  open,
  onOpenChange,
  topic,
  lessonContentExcerpt,
}: LessonQuizModalProps) {
  const [questions, setQuestions] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuestions([]);
    setCurrentIndex(0);
    setSelected(null);
    setScore(0);
    setLoading(true);
    fetch("/api/lesson-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, lessonContent: lessonContentExcerpt }),
    })
      .then((r) => r.json())
      .then((d) => {
        setQuestions(Array.isArray(d.questions) ? d.questions : []);
      })
      .finally(() => setLoading(false));
  }, [open, topic, lessonContentExcerpt]);

  const current = questions[currentIndex];
  const answered = selected !== null;

  const handleSelect = (index: number) => {
    if (answered) return;
    setSelected(index);
    if (index === current?.correctIndex) setScore((s) => s + 1);
  };

  const next = () => {
    setSelected(null);
    if (currentIndex + 1 >= questions.length) {
      onOpenChange(false);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg outline-none">
          <Dialog.Title className="text-lg font-semibold">Test your understanding</Dialog.Title>
          {loading ? (
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">Generating questions…</p>
          ) : questions.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">No questions generated. Try again.</p>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-[var(--muted-foreground)]">
                Question {currentIndex + 1} of {questions.length}
              </p>
              <p className="mt-2 font-medium">{current?.question}</p>
              <ul className="mt-3 space-y-2">
                {current?.options.map((opt, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => handleSelect(i)}
                      disabled={answered}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                        answered
                          ? i === current.correctIndex
                            ? "border-green-500 bg-green-500/20"
                            : selected === i
                              ? "border-red-500 bg-red-500/20"
                              : "border-[var(--border)]"
                          : "border-[var(--border)] hover:bg-[var(--muted)]"
                      }`}
                    >
                      {opt}
                    </button>
                  </li>
                ))}
              </ul>
              {answered && (
                <div className="mt-4 rounded-lg bg-[var(--muted)]/50 p-3 text-sm">
                  <p className="font-medium">Explanation</p>
                  <p className="mt-1 text-[var(--muted-foreground)]">{current?.explanation}</p>
                  <button
                    type="button"
                    onClick={next}
                    className="mt-3 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)]"
                  >
                    {currentIndex + 1 >= questions.length ? "Done" : "Next"}
                  </button>
                </div>
              )}
            </div>
          )}
          {questions.length > 0 && answered && currentIndex + 1 >= questions.length && (
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              Score: {score} / {questions.length}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
