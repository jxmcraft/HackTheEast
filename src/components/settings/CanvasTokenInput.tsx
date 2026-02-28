"use client";

import { PasswordInput } from "@/components/settings/PasswordInput";

export function CanvasTokenInput({
  canvasApiUrl,
  canvasApiKey,
  onUrlChange,
  onKeyChange,
  onSave,
  saving,
  saveError,
}: {
  canvasApiUrl: string;
  canvasApiKey: string;
  onUrlChange: (v: string) => void;
  onKeyChange: (v: string) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  saveError: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="canvas_api_url" className="text-sm font-medium">
          Canvas API URL
        </label>
        <input
          id="canvas_api_url"
          type="url"
          value={canvasApiUrl}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://your-school.instructure.com"
          className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <p className="text-xs text-[var(--muted-foreground)]">Your Canvas instance base URL (no trailing slash).</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="canvas_api_key" className="text-sm font-medium">
          Canvas Access Token
        </label>
        <PasswordInput
          id="canvas_api_key"
          name="canvas_api_key"
          value={canvasApiKey}
          onChange={(e) => onKeyChange(e.target.value)}
          placeholder="Paste your Canvas API token"
        />
        <p className="text-xs text-[var(--muted-foreground)]">From Canvas → Profile → Settings → New Access Token.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save credentials"}
        </button>
      </div>
      {saveError && <p className="text-sm text-red-400">{saveError}</p>}
    </div>
  );
}
