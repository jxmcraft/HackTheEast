"use client";

type ScriptLine = { speaker: string; text: string };

type Props = { script: ScriptLine[]; durationSeconds: number };

export function AudioLessonView({ script, durationSeconds }: Props) {
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  const durationLabel = mins > 0 ? `${mins} min ${secs} s` : `${secs} s`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted-foreground)]">
        {durationSeconds > 0 && (
          <>Estimated duration: {durationLabel} (read aloud). </>
        )}
        No audio file for this lesson yet. Use the script below, or generate a podcast from the lesson page to hear it read aloud.
      </p>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="space-y-4">
          {script.map((line, i) => (
            <div key={i} className="flex gap-3">
              <span className="shrink-0 text-sm font-medium text-[var(--muted-foreground)]">
                {line.speaker}:
              </span>
              <p className="text-sm">{line.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
