"use client";

import { useState } from "react";
import { updateCanvasCredentials } from "./actions";
import { PasswordInput } from "@/components/settings/PasswordInput";

export function SettingsForm({
  canvasApiUrl: initialUrl,
  canvasApiKey: initialKey,
}: {
  canvasApiUrl: string;
  canvasApiKey: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [key, setKey] = useState(initialKey);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<"success" | "error" | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const formData = new FormData(e.currentTarget);
      await updateCanvasCredentials(formData);
      setMessage("success");
    } catch {
      setMessage("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <div className="space-y-2">
        <label htmlFor="canvas_api_url" className="text-sm font-medium">
          Canvas API URL
        </label>
        <input
          id="canvas_api_url"
          name="canvas_api_url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-school.instructure.com"
          className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <p className="text-xs text-[var(--muted-foreground)]">
          Your Canvas instance base URL (no trailing slash).
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="canvas_api_key" className="text-sm font-medium">
          Canvas Access Token
        </label>
        <PasswordInput
          id="canvas_api_key"
          name="canvas_api_key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste your Canvas API token"
        />
        <p className="text-xs text-[var(--muted-foreground)]">
          From Canvas → Profile → Settings → New Access Token.
        </p>
      </div>
      {message === "success" && (
        <p className="text-sm text-emerald-400">Settings saved successfully.</p>
      )}
      {message === "error" && (
        <p className="text-sm text-red-400">Failed to save. Try again.</p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
