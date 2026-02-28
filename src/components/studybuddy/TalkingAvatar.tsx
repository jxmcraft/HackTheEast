"use client";

import React from "react";
import { CustomAvatar } from "./AvatarStudio";

/**
 * Avatar with animated head (idle look-around) and mouth (idle breath / speak).
 * Used in VideoTeacher and PersistentStudyBuddyAvatar for an interactive look.
 */
export default function TalkingAvatar({
  name,
  avatarConfig,
  size = 256,
  isSpeaking,
  /** When true, head and mouth idle animations run; set false for static (e.g. tiny icons). */
  interactive = true,
}: {
  name: string;
  avatarConfig: Record<string, string>;
  size?: number;
  isSpeaking: boolean;
  interactive?: boolean;
}) {
  const mouthWidth = Math.round(size * 0.24);
  const mouthHeight = Math.max(4, Math.round(size * 0.02));

  return (
    <div
      className="relative inline-block origin-center"
      style={{
        width: size,
        height: size,
        animation: interactive ? "head-idle 4s ease-in-out infinite" : undefined,
      }}
    >
      <CustomAvatar name={name} avatarConfig={avatarConfig} size={size} />
      {/* Mouth overlay: idle subtle movement, or speak animation when isSpeaking */}
      <div
        className="absolute left-1/2 bg-gray-800 rounded-full origin-center"
        style={{
          bottom: "22%",
          marginLeft: -mouthWidth / 2,
          width: mouthWidth,
          height: mouthHeight,
          transform: "translateX(-50%)",
          transformOrigin: "center center",
          animation: isSpeaking ? "mouth-speak 0.4s ease-in-out infinite" : undefined,
        }}
      />
    </div>
  );
}
