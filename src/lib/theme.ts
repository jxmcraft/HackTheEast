/**
 * Theme system: presets and CSS variable names.
 * All colors are applied to :root for app-wide consistency.
 */

export type ThemePalette = {
  id: string;
  name: string;
  colors: ThemeColors;
};

export type ThemeColors = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  ring: string;
  primary: string;
  primaryHover: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  surface: string;
  surfaceElevated: string;
  success: string;
  warning: string;
  error: string;
};

export const THEME_STORAGE_KEY = "hte_theme";

export const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  border: "--border",
  ring: "--ring",
  primary: "--color-primary",
  primaryHover: "--color-primary-hover",
  primaryForeground: "--color-primary-foreground",
  accent: "--color-accent",
  accentForeground: "--color-accent-foreground",
  surface: "--color-surface",
  surfaceElevated: "--color-surface-elevated",
  success: "--color-success",
  warning: "--color-warning",
  error: "--color-error",
};

export const THEME_PRESETS: ThemePalette[] = [
  {
    id: "default",
    name: "Default",
    colors: {
      background: "#0a0a0a",
      foreground: "#fafafa",
      card: "#141414",
      cardForeground: "#fafafa",
      muted: "#262626",
      mutedForeground: "#a3a3a3",
      border: "#262626",
      ring: "#525252",
      primary: "#9333ea",
      primaryHover: "#7c3aed",
      primaryForeground: "#ffffff",
      accent: "#a855f7",
      accentForeground: "#ffffff",
      surface: "#171717",
      surfaceElevated: "#262626",
      success: "#22c55e",
      warning: "#eab308",
      error: "#ef4444",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    colors: {
      background: "#0c1929",
      foreground: "#e2e8f0",
      card: "#0f2744",
      cardForeground: "#e2e8f0",
      muted: "#1e3a5f",
      mutedForeground: "#94a3b8",
      border: "#1e3a5f",
      ring: "#0ea5e9",
      primary: "#0ea5e9",
      primaryHover: "#38bdf8",
      primaryForeground: "#ffffff",
      accent: "#06b6d4",
      accentForeground: "#ffffff",
      surface: "#0f2744",
      surfaceElevated: "#1e3a5f",
      success: "#2dd4bf",
      warning: "#fbbf24",
      error: "#f87171",
    },
  },
  {
    id: "forest",
    name: "Forest",
    colors: {
      background: "#0d1f0d",
      foreground: "#ecfdf5",
      card: "#134e1a",
      cardForeground: "#ecfdf5",
      muted: "#14532d",
      mutedForeground: "#86efac",
      border: "#14532d",
      ring: "#22c55e",
      primary: "#22c55e",
      primaryHover: "#4ade80",
      primaryForeground: "#052e16",
      accent: "#10b981",
      accentForeground: "#ffffff",
      surface: "#134e1a",
      surfaceElevated: "#166534",
      success: "#34d399",
      warning: "#facc15",
      error: "#f87171",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    colors: {
      background: "#1c0a0a",
      foreground: "#fef3c7",
      card: "#451a1a",
      cardForeground: "#fef3c7",
      muted: "#7f1d1d",
      mutedForeground: "#fcd34d",
      border: "#7f1d1d",
      ring: "#f97316",
      primary: "#f97316",
      primaryHover: "#fb923c",
      primaryForeground: "#ffffff",
      accent: "#ea580c",
      accentForeground: "#ffffff",
      surface: "#451a1a",
      surfaceElevated: "#7f1d1d",
      success: "#22c55e",
      warning: "#eab308",
      error: "#dc2626",
    },
  },
  {
    id: "monochrome",
    name: "Monochrome",
    colors: {
      background: "#0a0a0a",
      foreground: "#fafafa",
      card: "#171717",
      cardForeground: "#fafafa",
      muted: "#262626",
      mutedForeground: "#a3a3a3",
      border: "#404040",
      ring: "#737373",
      primary: "#a3a3a3",
      primaryHover: "#d4d4d4",
      primaryForeground: "#0a0a0a",
      accent: "#525252",
      accentForeground: "#fafafa",
      surface: "#171717",
      surfaceElevated: "#262626",
      success: "#22c55e",
      warning: "#eab308",
      error: "#ef4444",
    },
  },
  {
    id: "canva",
    name: "Canva",
    colors: {
      background: "#1e1b4b",
      foreground: "#e0e7ff",
      card: "#312e81",
      cardForeground: "#e0e7ff",
      muted: "#3730a3",
      mutedForeground: "#a5b4fc",
      border: "#4f46e5",
      ring: "#6366f1",
      primary: "#6366f1",
      primaryHover: "#818cf8",
      primaryForeground: "#ffffff",
      accent: "#8b5cf6",
      accentForeground: "#ffffff",
      surface: "#312e81",
      surfaceElevated: "#4338ca",
      success: "#34d399",
      warning: "#fbbf24",
      error: "#f87171",
    },
  },
  {
    id: "light",
    name: "Light",
    colors: {
      background: "#f8fafc",
      foreground: "#0f172a",
      card: "#ffffff",
      cardForeground: "#0f172a",
      muted: "#f1f5f9",
      mutedForeground: "#64748b",
      border: "#e2e8f0",
      ring: "#94a3b8",
      primary: "#6366f1",
      primaryHover: "#4f46e5",
      primaryForeground: "#ffffff",
      accent: "#8b5cf6",
      accentForeground: "#ffffff",
      surface: "#ffffff",
      surfaceElevated: "#f8fafc",
      success: "#22c55e",
      warning: "#eab308",
      error: "#ef4444",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    colors: {
      background: "#020617",
      foreground: "#f8fafc",
      card: "#0f172a",
      cardForeground: "#f8fafc",
      muted: "#1e293b",
      mutedForeground: "#94a3b8",
      border: "#334155",
      ring: "#64748b",
      primary: "#3b82f6",
      primaryHover: "#60a5fa",
      primaryForeground: "#ffffff",
      accent: "#0ea5e9",
      accentForeground: "#ffffff",
      surface: "#0f172a",
      surfaceElevated: "#1e293b",
      success: "#22c55e",
      warning: "#eab308",
      error: "#ef4444",
    },
  },
];
