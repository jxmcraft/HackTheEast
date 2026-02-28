"use client";

import { FileText, Headphones, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";

export type LearningMode = "text" | "audio" | "slides";

const OPTIONS: {
  value: LearningMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "text",
    label: "Text - Bullet Points",
    description: "Structured notes with key points and summaries.",
    icon: FileText,
  },
  {
    value: "audio",
    label: "Audio - Podcast",
    description: "Listen to lessons on the go.",
    icon: Headphones,
  },
  {
    value: "slides",
    label: "Slide - Visual",
    description: "Presentation-style slides for visual learning.",
    icon: Presentation,
  },
];

export function LearningModeSelector({
  value,
  onChange,
  disabled,
}: {
  value: LearningMode;
  onChange: (mode: LearningMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition",
              selected
                ? "border-[var(--ring)] bg-[var(--muted)]"
                : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--muted-foreground)]",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <Icon className="h-5 w-5 text-[var(--muted-foreground)]" />
            <span className="font-medium">{opt.label}</span>
            <span className="text-xs text-[var(--muted-foreground)]">{opt.description}</span>
          </button>
        );
      })}
    </div>
  );
}
