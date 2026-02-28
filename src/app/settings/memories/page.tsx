"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Brain,
  Trash2,
  Download,
  Filter,
  SortDesc,
  Loader2,
} from "lucide-react";

type Memory = {
  id: string;
  memory_type: string;
  content: string;
  importance_score: number;
  source_lesson_id: string | null;
  created_at: string;
  last_accessed: string | null;
};

const MEMORY_TYPES = [
  "concept_struggle",
  "concept_mastered",
  "learning_preference",
  "topic_interest",
] as const;

const typeLabel: Record<string, string> = {
  concept_struggle: "Struggle",
  concept_mastered: "Mastered",
  learning_preference: "Preference",
  topic_interest: "Interest",
};

export default function SettingsMemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("");
  const [sort, setSort] = useState<"importance" | "date">("importance");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editImportance, setEditImportance] = useState(5);
  const [clearConfirm, setClearConfirm] = useState(false);

  const fetchMemories = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    params.set("sort", sort);
    const res = await fetch(`/api/memories?${params}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? res.statusText);
    }
    const data = await res.json();
    setMemories(data.memories ?? []);
  }, [filterType, sort]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMemories()
      .then(() => { if (!cancelled) setLoading(false); })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [fetchMemories]);

  async function updateImportance(id: string, importance: number) {
    const res = await fetch(`/api/memories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importance_score: importance }),
    });
    if (!res.ok) return;
    setEditingId(null);
    await fetchMemories();
  }

  async function deleteMemory(id: string) {
    const res = await fetch(`/api/memories/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    await fetchMemories();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(memories, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `learning-memories-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function clearAll() {
    if (!clearConfirm) return;
    await Promise.all(memories.map((m) => fetch(`/api/memories/${m.id}`, { method: "DELETE" })));
    setClearConfirm(false);
    setMemories([]);
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              ← Settings
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Brain className="h-7 w-7 text-[var(--muted-foreground)]" />
              Learning memories
            </h1>
          </div>
        </header>
        <p className="text-sm text-[var(--muted-foreground)]">
          Memories are created when you complete lessons. You can edit importance, delete, or export them.
        </p>

        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--muted-foreground)]" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm"
            >
              <option value="">All types</option>
              {MEMORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel[t] ?? t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <SortDesc className="h-4 w-4 text-[var(--muted-foreground)]" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "importance" | "date")}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm"
            >
              <option value="importance">Importance</option>
              <option value="date">Date</option>
            </select>
          </div>
          <button
            type="button"
            onClick={exportJson}
            disabled={memories.length === 0}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </button>
          {memories.length > 0 && (
            <>
              {!clearConfirm ? (
                <button
                  type="button"
                  onClick={() => setClearConfirm(true)}
                  className="rounded-lg border border-red-500/50 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10"
                >
                  Clear all
                </button>
              ) : (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clearAll}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
                  >
                    Confirm clear all
                  </button>
                  <button
                    type="button"
                    onClick={() => setClearConfirm(false)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)]"
                  >
                    Cancel
                  </button>
                </span>
              )}
            </>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : memories.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted-foreground)]">
            <p>No memories yet.</p>
            <p className="mt-2 text-sm">Complete lessons and use the tutor to build your learning history.</p>
            <Link href="/sync-dashboard" className="mt-4 inline-block text-sm text-[var(--foreground)] underline">
              Go to dashboard
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {memories.map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{m.content}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <span className="rounded bg-[var(--muted)] px-1.5 py-0.5">
                        {typeLabel[m.memory_type] ?? m.memory_type}
                      </span>
                      <span>Importance: {m.importance_score}</span>
                      <span>{formatDate(m.created_at)}</span>
                      {m.source_lesson_id && (
                        <span>Lesson: {m.source_lesson_id.slice(0, 8)}…</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingId === m.id ? (
                      <>
                        <select
                          value={editImportance}
                          onChange={(e) => setEditImportance(parseInt(e.target.value, 10))}
                          className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => updateImportance(m.id, editImportance)}
                          className="rounded bg-[var(--primary)] px-2 py-1 text-sm text-[var(--primary-foreground)]"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded border border-[var(--border)] px-2 py-1 text-sm hover:bg-[var(--muted)]"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(m.id);
                            setEditImportance(m.importance_score);
                          }}
                          className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--muted)]"
                        >
                          Edit importance
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMemory(m.id)}
                          className="rounded border border-red-500/50 p-1.5 text-red-500 hover:bg-red-500/10"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
