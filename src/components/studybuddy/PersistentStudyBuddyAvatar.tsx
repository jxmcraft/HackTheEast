"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUserData } from "@/lib/studybuddyStorage";
import TalkingAvatar from "./TalkingAvatar";

const PERSISTENT_AVATAR_SIZE = 56;

/**
 * Persistent StudyBuddy avatar shown on every page (fixed corner).
 * Same avatar identity across the app; head and mouth animate for an interactive look.
 */
export default function PersistentStudyBuddyAvatar() {
  const pathname = usePathname();
  const [userData, setUserData] = useState<ReturnType<typeof getUserData>>(null);

  useEffect(() => {
    setUserData(getUserData());
    const refresh = () => setUserData(getUserData());
    window.addEventListener("storage", refresh);
    window.addEventListener("studybuddy-user-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("studybuddy-user-updated", refresh);
    };
  }, [pathname]);

  if (!userData?.avatarProfile.avatarName || !userData?.avatarProfile.avatarConfig) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Link
        href="/studybuddy"
        className="flex items-center gap-2 rounded-full bg-[var(--card)] border border-[var(--border)] shadow-lg p-1 pr-3 hover:bg-[var(--muted)]/50 transition-colors"
        aria-label="Open StudyBuddy"
      >
        <div
          className="rounded-full overflow-hidden ring-2 ring-purple-500/30 shrink-0"
          style={{ width: PERSISTENT_AVATAR_SIZE, height: PERSISTENT_AVATAR_SIZE }}
        >
          <TalkingAvatar
            name={userData.avatarProfile.avatarName}
            avatarConfig={userData.avatarProfile.avatarConfig}
            size={PERSISTENT_AVATAR_SIZE}
            isSpeaking={false}
            interactive={true}
          />
        </div>
        <span className="text-sm font-medium text-[var(--foreground)] hidden sm:inline">
          {userData.avatarProfile.avatarName}
        </span>
      </Link>
    </div>
  );
}
