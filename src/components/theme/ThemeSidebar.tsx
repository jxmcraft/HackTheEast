"use client";

import React, { useState } from "react";
import { Palette, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { THEME_PRESETS, type ThemeColors, type ThemePalette } from "@/lib/theme";

const COLOR_KEYS: { key: keyof ThemeColors; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "primaryHover", label: "Primary Hover" },
  { key: "accent", label: "Accent" },
  { key: "background", label: "Background" },
  { key: "surface", label: "Surface" },
  { key: "foreground", label: "Foreground" },
  { key: "mutedForeground", label: "Muted Text" },
  { key: "border", label: "Border" },
];

export default function ThemeSidebar() {
  const { theme, setTheme, customColors, setCustomColor, resetToPreset } = useTheme();
  const [open, setOpen] = useState(false);
  const [showColorTable, setShowColorTable] = useState(false);

  const effectiveColors = customColors ? { ...theme.colors, ...customColors } : theme.colors;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-10 h-14 rounded-l-lg rounded-r-none bg-[var(--color-surface-elevated)] border border-r-0 border-[var(--border)] shadow-lg hover:bg-[var(--color-surface)] transition-colors"
        title="Theme & colors"
        aria-label="Open theme settings"
      >
        <Palette className="w-5 h-5 text-[var(--color-primary)]" />
      </button>

      <div
        className={`fixed right-0 top-0 h-full w-80 max-w-[calc(100vw-2rem)] bg-[var(--card)] border-l border-[var(--border)] shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
            <Palette className="w-5 h-5 text-[var(--color-primary)]" />
            Theme & colors
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
            aria-label="Close theme panel"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <section>
            <h3 className="text-sm font-medium text-[var(--muted-foreground)] mb-3">
              Color palettes
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {THEME_PRESETS.map((p) => (
                <PresetCard
                  key={p.id}
                  preset={p}
                  selected={theme.id === p.id && !customColors}
                  onSelect={() => setTheme(p)}
                />
              ))}
            </div>
          </section>

          <section>
            <button
              onClick={() => setShowColorTable(!showColorTable)}
              className="w-full flex items-center justify-between text-sm font-medium text-[var(--foreground)] py-2 px-3 rounded-lg hover:bg-[var(--muted)] transition-colors"
            >
              <span>Customize colors</span>
              <ChevronLeft
                className={`w-4 h-4 transition-transform ${showColorTable ? "rotate-90" : "-rotate-90"}`}
              />
            </button>

            {showColorTable && (
              <div className="mt-3 space-y-3 p-3 rounded-lg bg-[var(--muted)]/40 border border-[var(--border)]">
                {customColors && (
                  <button
                    onClick={resetToPreset}
                    className="flex items-center gap-2 text-xs text-[var(--color-primary)] hover:underline"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset to preset
                  </button>
                )}
                {COLOR_KEYS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs text-[var(--muted-foreground)] mb-1">
                        {label}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={effectiveColors[key]}
                          onChange={(e) => setCustomColor(key, e.target.value)}
                          className="w-10 h-8 rounded border border-[var(--border)] cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={effectiveColors[key]}
                          onChange={(e) => setCustomColor(key, e.target.value)}
                          className="flex-1 px-2 py-1.5 text-xs rounded bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
    </>
  );
}

function PresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: ThemePalette;
  selected: boolean;
  onSelect: () => void;
}) {
  const { primary, accent, background, surface } = preset.colors;
  return (
    <button
      onClick={onSelect}
      className={`rounded-lg border-2 p-3 text-left transition-all ${
        selected
          ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30"
          : "border-[var(--border)] hover:border-[var(--muted-foreground)]/50"
      }`}
    >
      <div className="flex gap-1 mb-2">
        <div
          className="w-6 h-6 rounded-full shrink-0"
          style={{ backgroundColor: primary }}
        />
        <div
          className="w-6 h-6 rounded-full shrink-0"
          style={{ backgroundColor: accent }}
        />
        <div
          className="w-6 h-6 rounded-full shrink-0"
          style={{ backgroundColor: surface }}
        />
        <div
          className="w-6 h-6 rounded-full shrink-0"
          style={{ backgroundColor: background }}
        />
      </div>
      <p className="text-xs font-medium text-[var(--foreground)] truncate">
        {preset.name}
      </p>
    </button>
  );
}
