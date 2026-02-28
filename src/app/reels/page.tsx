"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Video, Loader2, Settings, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

type GeneratedReel = {
  script: string;
  audioUrl: string;
  videoUrl?: string;
  imageUrl?: string;
  title: string;
  durationSec: number;
};

export default function ReelsPage() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reel, setReel] = useState<GeneratedReel | null>(null);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const playBoth = useCallback(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      v?.pause();
      setPlaying(false);
    } else {
      a.currentTime = 0;
      if (v) v.currentTime = 0;
      a.play();
      v?.play();
      setPlaying(true);
    }
  }, [playing]);

  const onEnded = useCallback(() => {
    setPlaying(false);
    videoRef.current?.pause();
    if (videoRef.current) videoRef.current.currentTime = 0;
  }, []);

  function handleGenerate() {
    setError(null);
    setGenerating(true);
    setReel(null);

    fetch("/api/reels/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setReel(null);
        } else {
          setReel({
            script: data.script,
            audioUrl: data.audioUrl,
            videoUrl: data.videoUrl,
            imageUrl: data.imageUrl,
            title: data.title ?? "Instagram 15-second reel",
            durationSec: data.durationSec ?? 0,
          });
          setPlaying(false);
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to generate reel.");
        setReel(null);
      })
      .finally(() => setGenerating(false));
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/sync-dashboard"
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              ← Dashboard
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Video className="h-7 w-7 text-[var(--muted-foreground)]" />
              Instagram 15-Second Reels
            </h1>
            <Link
              href="/settings"
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)]"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <p className="text-sm text-[var(--muted-foreground)]">
          We generate Instagram videos — 15-second reels — from what you&apos;re learning. Random short reels from your recent lessons or synced course materials. One tap; voice and video by MiniMax (API key is for generating these Instagram 15-second reels).
        </p>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-6">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className={cn(
              "flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50",
              generating && "cursor-not-allowed"
            )}
          >
            {generating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating Instagram 15-second reel…
              </>
            ) : (
              <>
                <Video className="h-5 w-5" />
                Generate Instagram 15-second reel
              </>
            )}
          </button>
        </section>

        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {reel && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-6">
            <h2 className="mb-4 text-lg font-semibold">Your Instagram 15-second reel</h2>
            <div className="flex flex-col items-center gap-6 md:flex-row md:items-stretch">
              {/* Vertical 9:16 — video or image, with one Play button for both. Only use absolute URLs so media loads. */}
              <div className="w-full max-w-[280px] shrink-0 overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-black shadow-lg" style={{ aspectRatio: "9/16" }}>
                {reel.videoUrl && reel.videoUrl.startsWith("http") ? (
                  <>
                    <video
                      ref={videoRef}
                      src={reel.videoUrl}
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                      preload="metadata"
                      onEnded={onEnded}
                    />
                    <audio
                      ref={audioRef}
                      src={reel.audioUrl}
                      preload="metadata"
                      onEnded={onEnded}
                      className="hidden"
                    />
                  </>
                ) : reel.imageUrl && reel.imageUrl.startsWith("http") ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={reel.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <audio
                      ref={audioRef}
                      src={reel.audioUrl}
                      preload="metadata"
                      onEnded={() => setPlaying(false)}
                      className="hidden"
                    />
                  </>
                ) : (
                  <div className="relative flex h-full w-full flex-col justify-between p-4 bg-gradient-to-b from-[var(--muted)]/30 to-[var(--card)]">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Instagram 15s reel</div>
                    <p className="text-lg font-semibold leading-tight line-clamp-2">{reel.title}</p>
                    <div className="rounded-xl bg-black/20 p-3 backdrop-blur-sm">
                      <p className="text-sm leading-snug line-clamp-4">{reel.script}</p>
                    </div>
                    <audio
                      ref={audioRef}
                      src={reel.audioUrl}
                      preload="metadata"
                      onEnded={() => setPlaying(false)}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col justify-center gap-4">
                <p className="text-sm font-medium">{reel.title}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  ~{reel.durationSec}s · Instagram 15-second reel · Play video + voice together
                </p>
                <button
                  type="button"
                  onClick={playBoth}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-neutral-200"
                >
                  {playing ? (
                    <>
                      <Pause className="h-5 w-5" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5" />
                      Play (video + voice)
                    </>
                  )}
                </button>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={reel.audioUrl}
                    download={`reel-${reel.title.replace(/\W+/g, "-").slice(0, 30)}.mp3`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--muted)]"
                  >
                    Download MP3
                  </a>
                  {reel.videoUrl && (
                    <a
                      href={reel.videoUrl}
                      download={`reel-${reel.title.replace(/\W+/g, "-").slice(0, 30)}.mp4`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--muted)]"
                    >
                      Download MP4
                    </a>
                  )}
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">Script:</p>
                <p className="max-h-32 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--muted)]/10 p-3 text-sm leading-relaxed">
                  {reel.script}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
