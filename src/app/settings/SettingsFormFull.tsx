"use client";

import { useState, useEffect } from "react";
import { LearningModeSelector, type LearningMode } from "@/components/settings/LearningModeSelector";
import { AvatarCustomizer, type AvatarStyle } from "@/components/settings/AvatarCustomizer";
import { CanvasTokenInput } from "@/components/settings/CanvasTokenInput";
import { updatePreferences, updateCanvasCredentials } from "@/app/settings/actions";

type Preferences = {
  learning_mode: LearningMode;
  avatar_style: AvatarStyle;
  avatar_name: string | null;
};

export function SettingsFormFull({
  preferences,
  canvasApiUrl,
  canvasApiKey,
  lastCanvasSyncAt,
}: {
  preferences: Preferences;
  canvasApiUrl: string;
  canvasApiKey: string;
  lastCanvasSyncAt: string | null;
}) {
  const [learningMode, setLearningMode] = useState<LearningMode>(preferences.learning_mode);
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>(preferences.avatar_style);
  const [avatarName, setAvatarName] = useState(preferences.avatar_name ?? "");
  const [url, setUrl] = useState(canvasApiUrl);
  const [key, setKey] = useState(canvasApiKey);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSuccess, setPrefSuccess] = useState(false);
  const [prefError, setPrefError] = useState<string | null>(null);
  const [credSaving, setCredSaving] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);

  useEffect(() => {
    setLearningMode(preferences.learning_mode);
    setAvatarStyle(preferences.avatar_style);
    setAvatarName(preferences.avatar_name ?? "");
  }, [preferences]);
  useEffect(() => { setUrl(canvasApiUrl); setKey(canvasApiKey); }, [canvasApiUrl, canvasApiKey]);

  async function handleSavePreferences() {
    setPrefSaving(true);
    setPrefError(null);
    setPrefSuccess(false);
    try {
      const formData = new FormData();
      formData.set("learning_mode", learningMode);
      formData.set("avatar_style", avatarStyle);
      formData.set("avatar_name", avatarName);
      await updatePreferences(formData);
      setPrefSuccess(true);
    } catch (e) {
      setPrefError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setPrefSaving(false);
    }
  }

  async function handleSaveCredentials() {
    setCredSaving(true);
    setCredError(null);
    try {
      const formData = new FormData();
      formData.set("canvas_api_url", url);
      formData.set("canvas_api_key", key);
      await updateCanvasCredentials(formData);
    } catch (e) {
      setCredError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setCredSaving(false);
    }
  }

  return (
    <div className="space-y-10">
      {/* A. Learning Method */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Learning Method</h2>
        <LearningModeSelector
          value={learningMode}
          onChange={setLearningMode}
          disabled={prefSaving}
        />
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={prefSaving}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
          >
            {prefSaving ? "Saving…" : "Save preferences"}
          </button>
          {prefSuccess && <span className="text-sm text-emerald-400">Saved.</span>}
          {prefError && <span className="text-sm text-red-400">{prefError}</span>}
        </div>
      </section>

      {/* B. Avatar */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Avatar Customization</h2>
        <AvatarCustomizer
          style={avatarStyle}
          name={avatarName}
          onStyleChange={setAvatarStyle}
          onNameChange={setAvatarName}
          disabled={prefSaving}
        />
        <div className="mt-4">
          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={prefSaving}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
          >
            {prefSaving ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </section>

      {/* C. Canvas API */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Canvas API Integration</h2>
        <CanvasTokenInput
          canvasApiUrl={url}
          canvasApiKey={key}
          onUrlChange={setUrl}
          onKeyChange={setKey}
          onSave={handleSaveCredentials}
          saving={credSaving}
          saveError={credError}
        />
      </section>
    </div>
  );
}
