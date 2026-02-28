"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { AvatarStyle } from "@/lib/avatar/personality";

type TutorAvatarProps = {
  name: string;
  style?: AvatarStyle;
  message?: string | null;
  isThinking?: boolean;
  isSpeaking?: boolean;
  /** When true, show as compact FAB on mobile */
  compact?: boolean;
  className?: string;
};

const styleThemes: Record<AvatarStyle, { border: string; bg: string }> = {
  strict: { border: "border-slate-500/50", bg: "bg-slate-100 dark:bg-slate-800/80" },
  encouraging: { border: "border-amber-400/50", bg: "bg-amber-50 dark:bg-amber-900/20" },
  socratic: { border: "border-violet-400/50", bg: "bg-violet-50 dark:bg-violet-900/20" },
};

const avatarVariants = {
  idle: { scale: 1, y: 0 },
  thinking: {
    scale: [1, 1.03, 1],
    y: [0, -2, 0],
    transition: { repeat: Infinity, duration: 1.2, ease: "easeInOut" as const },
  },
  speaking: {
    scale: [1, 1.02, 1],
    transition: { repeat: Infinity, duration: 0.8, ease: "easeInOut" as const },
  },
};

const bubbleVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
};

/** Simple tutor character SVG - friendly book/graduation style */
function TutorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="32" cy="24" r="14" fill="var(--avatar-face, #fcd5b0)" />
      <ellipse cx="32" cy="38" rx="20" ry="18" fill="var(--avatar-body, #6b7fd7)" />
      <path
        d="M18 38 L18 56 L46 56 L46 38"
        fill="var(--avatar-body, #6b7fd7)"
        stroke="var(--avatar-body, #5a6bc7)"
        strokeWidth="1"
      />
      <rect x="26" y="44" width="12" height="14" rx="1" fill="var(--avatar-book, #8b7355)" />
      <path
        d="M30 44 L30 58 M34 44 L34 58"
        stroke="var(--avatar-book-line, #6b5344)"
        strokeWidth="0.8"
      />
      <circle cx="28" cy="22" r="2" fill="var(--avatar-eye, #333)" />
      <circle cx="36" cy="22" r="2" fill="var(--avatar-eye, #333)" />
      <path
        d="M28 28 Q32 32 36 28"
        stroke="var(--avatar-mouth, #c45c4a)"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TutorAvatar({
  name,
  style = "encouraging",
  message,
  isThinking = false,
  isSpeaking = false,
  compact = false,
  className = "",
}: TutorAvatarProps) {
  const theme = styleThemes[style];
  const state = isThinking ? "thinking" : isSpeaking ? "speaking" : "idle";

  const content = (
    <>
      <motion.div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${theme.border} border-2 ${theme.bg} ${compact ? "h-12 w-12" : "h-16 w-16 md:h-20 md:w-20"}`}
        animate={state}
        variants={avatarVariants}
        initial="idle"
      >
        <TutorIcon className={compact ? "h-8 w-8" : "h-10 w-10 md:h-12 md:w-12"} />
        {isThinking && (
          <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/90 text-xs" aria-hidden>
            ?
          </span>
        )}
      </motion.div>
      <AnimatePresence mode="wait">
        {(message || isThinking) && (
          <motion.div
            key={message ?? "thinking"}
            layout
            className={`rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 shadow-sm ${compact ? "max-w-[140px] text-xs" : "min-w-[120px] max-w-[220px] text-sm md:max-w-[260px]"}`}
            variants={bubbleVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <p className="font-medium text-[var(--foreground)]">{name}</p>
            <p className="mt-0.5 text-[var(--muted-foreground)]">
              {isThinking && !message ? "Thinking…" : message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {content}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4 ${className}`}>
      {content}
    </div>
  );
}
