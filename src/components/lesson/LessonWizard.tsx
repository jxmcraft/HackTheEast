"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { CourseSelector } from "@/components/course/CourseSelector";
import type { CourseOption } from "@/components/course/CourseCard";
import { cn } from "@/lib/utils";

const STEPS = ["Select Course", "Define Topic", "Review & Generate"];

export function LessonWizard({
  onComplete,
}: {
  onComplete: (courseId: number, courseName: string, topic: string, context: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseOption | null>(null);
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  async function loadCourses() {
    setLoading(true);
    setCourseError(null);
    try {
      const res = await fetch("/api/canvas/courses");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load courses");
      setCourses(Array.isArray(data) ? data : []);
    } catch (e) {
      setCourseError(e instanceof Error ? e.message : "Failed to load courses");
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }

  if (courses.length === 0 && !loading && !courseError) {
    loadCourses();
  }

  const canNextStep1 = selectedCourse != null;
  const canNextStep2 = topic.trim().length >= 3;

  function goNext() {
    setValidationError(null);
    if (step === 1 && !canNextStep1) {
      setValidationError("Please select a course.");
      return;
    }
    if (step === 2 && !canNextStep2) {
      setValidationError("Topic must be at least 3 characters.");
      return;
    }
    if (step < 3) setStep(step + 1);
    else {
      setSubmitting(true);
      onComplete(selectedCourse!.id, selectedCourse!.name, topic.trim(), context.trim());
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        {STEPS.map((label, i) => (
          <span key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5",
                step === i + 1 ? "bg-[var(--ring)] text-white" : "bg-[var(--muted)]"
              )}
            >
              {i + 1}
            </span>
            {label}
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4" />}
          </span>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Step 1: Select Course</h2>
          <CourseSelector
            courses={courses}
            onSelect={setSelectedCourse}
            selectedCourseId={selectedCourse?.id ?? null}
            loading={loading}
            error={courseError}
          />
          {selectedCourse && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Selected: <strong>{selectedCourse.name}</strong>
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Step 2: Define Topic</h2>
          <div className="space-y-2">
            <label htmlFor="topic" className="text-sm font-medium">
              What do you want to learn?
            </label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Thermodynamics, Chapter 3"
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="context" className="text-sm font-medium">
              Specific context <span className="text-[var(--muted-foreground)]">(optional)</span>
            </label>
            <textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g., Focus on the examples from Lecture 5"
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Step 3: Review & Generate</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-2">
            <p><span className="text-[var(--muted-foreground)]">Course:</span> {selectedCourse?.name}</p>
            <p><span className="text-[var(--muted-foreground)]">Topic:</span> {topic}</p>
            {context && <p><span className="text-[var(--muted-foreground)]">Context:</span> {context}</p>}
          </div>
        </div>
      )}

      {validationError && (
        <p className="text-sm text-red-400">{validationError}</p>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={(step === 1 && !canNextStep1) || (step === 2 && !canNextStep2) || submitting}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
        >
          {step < 3 ? "Next" : submitting ? "Starting…" : "Start Lesson"}
        </button>
      </div>
    </div>
  );
}
