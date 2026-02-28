"use client";

import { cn } from "@/lib/utils";

export type AvatarStyle = "strict" | "encouraging" | "socratic";

const STYLES: { value: AvatarStyle; label: string; description: string }[] = [
  { value: "strict", label: "Strict", description: "Formal, direct teaching style" },
  { value: "encouraging", label: "Encouraging", description: "Supportive, positive reinforcement" },
  { value: "socratic", label: "Socratic", description: "Question-based, guides through inquiry" },
];

export function AvatarCustomizer({
  style,
  name,
  onStyleChange,
  onNameChange,
  disabled,
}: {
  style: AvatarStyle;
  name: string;
  onStyleChange: (s: AvatarStyle) => void;
  onNameChange: (s: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Avatar Style</label>
        <select
          value={style}
          onChange={(e) => onStyleChange(e.target.value as AvatarStyle)}
          disabled={disabled}
          className={cn(
            "w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          {STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label} – {s.description}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor="avatar_name" className="text-sm font-medium">
          Avatar Name <span className="text-[var(--muted-foreground)]">(optional)</span>
        </label>
        <input
          id="avatar_name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={disabled}
          placeholder="e.g., Study Buddy"
          className={cn(
            "w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]",
            disabled && "cursor-not-allowed opacity-60"
          )}
        />
      </div>
    </div>
  );
}
