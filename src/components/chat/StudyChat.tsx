"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AvatarStyle } from "@/lib/avatar/personality";

type ChatMessage = { role: "user" | "tutor"; content: string; createdAt?: string };

type StudyChatProps = {
  lessonId: string | null;
  topic: string;
  lessonContentExcerpt?: string;
  avatarStyle?: AvatarStyle;
  suggestedQuestions?: string[];
  onMessageSent?: () => void;
  onResponseReceived?: (message: string) => void;
  className?: string;
};

function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
      title="Copy"
      aria-label="Copy message"
    >
      {copied ? "✓" : "⎘"}
    </button>
  );
}

export function StudyChat({
  lessonId,
  topic,
  lessonContentExcerpt,
  avatarStyle = "encouraging",
  suggestedQuestions = [],
  onMessageSent,
  onResponseReceived,
  className = "",
}: StudyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!lessonId || historyLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat-tutor?lessonId=${encodeURIComponent(lessonId)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data.success && Array.isArray(data.history)) {
          setMessages(
            data.history.map((h: { role: string; content: string }) => ({
              role: h.role as "user" | "tutor",
              content: h.content,
              createdAt: new Date().toISOString(),
            }))
          );
        }
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, historyLoaded]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || loading) return;
      setInput("");
      const userMsg: ChatMessage = { role: "user", content: q, createdAt: new Date().toISOString() };
      setMessages((prev) => [...prev, userMsg]);
      onMessageSent?.();
      setLoading(true);
      try {
        const res = await fetch("/api/chat-tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId,
            question: q,
            chatHistory: messages.map((m) => ({ role: m.role, content: m.content })),
            topic,
            lessonContent: lessonContentExcerpt,
            avatarStyle,
          }),
        });
        const data = await res.json().catch(() => ({}));
        const answer = data.answer ?? "I couldn't generate a response. Please try again.";
        const tutorMsg: ChatMessage = { role: "tutor", content: answer, createdAt: new Date().toISOString() };
        setMessages((prev) => [...prev, tutorMsg]);
        onResponseReceived?.(answer);
      } catch {
        const tutorMsg: ChatMessage = {
          role: "tutor",
          content: "Something went wrong. Please try again.",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, tutorMsg]);
        onResponseReceived?.("");
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, lessonId, topic, lessonContentExcerpt, avatarStyle, onMessageSent, onResponseReceived]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const suggestions = suggestedQuestions.length > 0 ? suggestedQuestions.slice(0, 3) : [
    `What is the main idea of ${topic}?`,
    "Can you give an example?",
    "How can I remember this?",
  ];

  const panel = (
    <div className="flex h-full min-h-[200px] max-h-[50vh] flex-col rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3"
      >
        {messages.length === 0 && !loading && (
          <p className="text-sm text-[var(--muted-foreground)]">Ask a follow-up question about the lesson.</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`flex max-w-[85%] flex-col gap-0.5 rounded-xl px-3 py-2 ${
                m.role === "user"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "bg-[var(--muted)] text-[var(--foreground)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs opacity-80">{m.role === "user" ? "You" : "Tutor"}</span>
                <span className="text-xs opacity-70">
                  {m.createdAt ? formatTime(new Date(m.createdAt)) : ""}
                </span>
                {m.role === "tutor" && <CopyButton text={m.content} />}
              </div>
              <p className="whitespace-pre-wrap text-sm">{m.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-[var(--muted)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
              Thinking…
            </div>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="border-t border-[var(--border)] p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a follow-up question..."
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => sendMessage(s)}
              disabled={loading}
              className="rounded-full border border-[var(--border)] bg-[var(--muted)]/50 px-3 py-1 text-xs hover:bg-[var(--muted)] disabled:opacity-50"
            >
              {s.length > 40 ? s.slice(0, 40) + "…" : s}
            </button>
          ))}
        </div>
      </form>
    </div>
  );

  return (
    <div className={className}>
      {/* Desktop: always show panel */}
      <div className="hidden md:block md:min-h-[280px]">{panel}</div>
      {/* Mobile: collapsible */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between rounded-t-lg border border-b-0 border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-medium"
        >
          <span>Q&A</span>
          <span>{expanded ? "▼" : "▲"}</span>
        </button>
        {expanded && <div className="min-h-[200px] border border-t-0 border-[var(--border)]">{panel}</div>}
      </div>
    </div>
  );
}
