"use client";

import React, { useState, useEffect, useRef } from "react";
import { CustomAvatar } from "./AvatarStudio";

/**
 * Avatar with animated head (idle look-around), mouth (idle breath / speak),
 * and optional blink. Can be driven by audioLevel for reactive lip motion.
 * Used in VideoTeacher and PersistentStudyBuddyAvatar for an interactive look.
 */
export default function TalkingAvatar({
  name,
  avatarConfig,
  size = 256,
  isSpeaking,
  /** When true, head, mouth, and blink run; set false for static (e.g. tiny icons). */
  interactive = true,
  /** 0–1 from audio analyser; when provided and isSpeaking, mouth scale follows level for lip-sync feel. */
  audioLevel,
}: {
  name: string;
  avatarConfig: Record<string, string>;
  size?: number;
  isSpeaking: boolean;
  interactive?: boolean;
  audioLevel?: number;
}) {
  const mouthWidth = Math.round(size * 0.24);
  const mouthHeight = Math.max(4, Math.round(size * 0.02));
  const [blinkKey, setBlinkKey] = useState(0);
  const nextBlinkRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Random blink every 2–5s when interactive
  useEffect(() => {
    if (!interactive) return;
    const scheduleBlink = () => {
      const delay = 2000 + Math.random() * 3000;
      nextBlinkRef.current = setTimeout(() => {
        setBlinkKey((k) => k + 1);
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => {
      if (nextBlinkRef.current) clearTimeout(nextBlinkRef.current);
    };
  }, [interactive]);

  const level = audioLevel != null ? Math.max(0, Math.min(1, audioLevel)) : null;
  const mouthScaleY =
    isSpeaking && level != null
      ? 0.5 + 0.9 * level
      : undefined;

  return (
    <div
      className="relative inline-block origin-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        animation: interactive ? "head-idle 5s ease-in-out infinite" : undefined,
      }}
    >
      <CustomAvatar name={name} avatarConfig={avatarConfig} size={size} />
      {/* Blink: band at eye level */}
      {interactive && (
        <div
          key={blinkKey}
          className="absolute left-0 right-0 rounded-full"
          style={{
            top: "28%",
            height: "14%",
            background: "rgba(0,0,0,0.35)",
            animation: "avatar-blink 0.2s ease-out forwards",
          }}
          aria-hidden
        />
      )}
      {/* Mouth overlay: idle breathing, speak animation, or audio-driven scale */}
      <div
        className="absolute left-1/2 bg-gray-800 rounded-full origin-center"
        style={{
          bottom: "22%",
          marginLeft: -mouthWidth / 2,
          width: mouthWidth,
          height: mouthHeight,
          transform:
            mouthScaleY != null
              ? `translateX(-50%) scaleY(${mouthScaleY})`
              : "translateX(-50%)",
          transformOrigin: "center center",
          animation:
            isSpeaking && mouthScaleY == null
              ? "mouth-speak 0.4s ease-in-out infinite"
              : !isSpeaking && interactive
                ? "mouth-idle 2.5s ease-in-out infinite"
                : undefined,
        }}
      />
    </div>
  );
}
