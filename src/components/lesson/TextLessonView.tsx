"use client";

import ReactMarkdown from "react-markdown";
import { useState } from "react";

type Props = { markdown: string; actions?: React.ReactNode };

export function TextLessonView({ markdown, actions }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="prose prose-invert max-w-none">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">{actions}</div>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-3 py-1.5 text-sm hover:bg-[var(--muted)]"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <ReactMarkdown
          components={{
            h2: ({ children }) => <h2 className="mt-6 mb-2 text-lg font-semibold first:mt-0">{children}</h2>,
            ul: ({ children }) => <ul className="list-disc space-y-1 pl-6">{children}</ul>,
            li: ({ children }) => <li className="text-[var(--foreground)]">{children}</li>,
            p: ({ children }) => <p className="mb-2 text-sm">{children}</p>,
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
