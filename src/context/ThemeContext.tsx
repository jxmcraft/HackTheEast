"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  THEME_PRESETS,
  THEME_STORAGE_KEY,
  CSS_VAR_MAP,
  type ThemePalette,
  type ThemeColors,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemePalette;
  setTheme: (palette: ThemePalette) => void;
  applyColors: (colors: ThemeColors) => void;
  customColors: Partial<ThemeColors> | null;
  setCustomColor: (key: keyof ThemeColors, value: string) => void;
  resetToPreset: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeToDocument(colors: ThemeColors) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  (Object.keys(colors) as (keyof ThemeColors)[]).forEach((key) => {
    const cssVar = CSS_VAR_MAP[key];
    const value = colors[key];
    if (cssVar && value) root.style.setProperty(cssVar, value);
  });
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePalette>(THEME_PRESETS[0]);
  const [customColors, setCustomColors] = useState<Partial<ThemeColors> | null>(null);

  const applyColors = useCallback((colors: ThemeColors) => {
    applyThemeToDocument(colors);
  }, []);

  const setTheme = useCallback(
    (palette: ThemePalette) => {
      setThemeState(palette);
      setCustomColors(null);
      applyThemeToDocument(palette.colors);
      try {
        localStorage.setItem(
          THEME_STORAGE_KEY,
          JSON.stringify({ type: "preset", id: palette.id })
        );
      } catch {}
    },
    []
  );

  const setCustomColor = useCallback(
    (key: keyof ThemeColors, value: string) => {
      setCustomColors((prev) => ({ ...prev, [key]: value }));
      const merged = { ...theme.colors, [key]: value };
      applyThemeToDocument(merged);
      try {
        localStorage.setItem(
          THEME_STORAGE_KEY,
          JSON.stringify({ type: "custom", colors: merged })
        );
      } catch {}
    },
    [theme.colors]
  );

  const resetToPreset = useCallback(() => {
    const target = theme.id === "custom" ? THEME_PRESETS[0] : theme;
    setThemeState(target);
    setCustomColors(null);
    applyThemeToDocument(target.colors);
    try {
      localStorage.setItem(
        THEME_STORAGE_KEY,
        JSON.stringify({ type: "preset", id: target.id })
      );
    } catch {}
  }, [theme]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as
        | { type: "preset"; id: string }
        | { type: "custom"; colors: ThemeColors };
      if (parsed.type === "preset") {
        const preset = THEME_PRESETS.find((p) => p.id === parsed.id);
        if (preset) {
          setThemeState(preset);
          applyThemeToDocument(preset.colors);
        }
      } else if (parsed.type === "custom" && parsed.colors) {
        setCustomColors(parsed.colors);
        applyThemeToDocument(parsed.colors);
        setThemeState({ id: "custom", name: "Custom", colors: parsed.colors });
      }
    } catch {
      applyThemeToDocument(theme.colors);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount to restore theme from localStorage
  }, []);

  useEffect(() => {
    if (!customColors) applyThemeToDocument(theme.colors);
  }, [theme.colors, customColors]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        applyColors,
        customColors,
        setCustomColor,
        resetToPreset,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
