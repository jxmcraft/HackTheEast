"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RefreshCw, AlertCircle, Sparkles, Loader2 } from "lucide-react";

type Recommendation = {
  type: "review" | "new_topic" | "practice";
  topic: string;
  courseId: string;
  reason: string;
  priority: number;
};

export function RecommendedLessons() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/recommendations?limit=10")
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setItems(data.recommendations ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
        {error}
      </div>
    );
  }

  const review = items.filter((r) => r.type === "review");
  const practice = items.filter((r) => r.type === "practice");
  const newTopics = items.filter((r) => r.type === "new_topic");

  const section = (
    title: string,
    list: Recommendation[],
    icon: React.ReactNode,
    emptyMsg: string
  ) => (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/10 p-4">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </h3>
      {list.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">{emptyMsg}</p>
      ) : (
        <ul className="space-y-2">
          {list.map((r) => (
            <li key={`${r.courseId}-${r.topic}`} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{r.topic}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{r.reason}</p>
              </div>
              <Link
                href={`/lesson/${r.courseId}/${encodeURIComponent(r.topic.replace(/\s+/g, "-").slice(0, 80))}`}
                className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-neutral-200"
              >
                Start lesson
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-2 text-lg font-semibold">Recommended lessons</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Complete some lessons and mark topics to get personalized recommendations here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Recommended lessons</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {section(
          "Review difficult topics",
          review,
          <AlertCircle className="h-4 w-4 text-amber-500" />,
          "No struggling topics to review."
        )}
        {section(
          "Continue learning",
          practice,
          <RefreshCw className="h-4 w-4 text-blue-500" />,
          "No topics to continue right now."
        )}
        {section(
          "New topics",
          newTopics,
          <Sparkles className="h-4 w-4 text-purple-500" />,
          "No new topics in progress yet."
        )}
      </div>
    </div>
  );
}
