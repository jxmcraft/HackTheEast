"use client";

type FallbackUsed = "none" | "partial" | "general" | "web_search" | "user_context";

type Props = {
  type: FallbackUsed;
  message?: string | null;
  onProvideContext?: () => void;
};

export function FallbackBanner({ type, message, onProvideContext }: Props) {
  if (type === "none") return null;

  const labels: Record<FallbackUsed, string> = {
    none: "",
    partial: "Partial match",
    general: "General knowledge",
    web_search: "Web search used",
    user_context: "From your content",
  };
  const displayMessage = message ?? (type === "general"
    ? "No course materials were found. This lesson uses general academic knowledge."
    : type === "web_search"
      ? "Some content from web sources. Verify with your course materials."
      : type === "partial"
        ? "Partial match found. Lesson may be augmented with general knowledge."
        : labels[type]);

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      <p className="font-medium">{labels[type]}</p>
      <p className="mt-1 text-[var(--muted-foreground)]">{displayMessage}</p>
      {onProvideContext && (
        <button
          type="button"
          onClick={onProvideContext}
          className="mt-2 text-sm underline hover:no-underline"
        >
          Need more context? Add your own materials
        </button>
      )}
    </div>
  );
}
