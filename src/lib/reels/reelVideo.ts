/**
 * Compose a short MP4 video from a cover image + audio (Instagram Reels style).
 * Uses ffmpeg-static to combine image (looped) + audio into a single MP4.
 */

import { spawn } from "child_process";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";
import ffmpegStatic from "ffmpeg-static";

/** Resolve path to ffmpeg. Next.js bundles can break ffmpeg-static's __dirname; use cwd/node_modules or system "ffmpeg". */
function getFfmpegPath(): string {
  const isWin = os.platform() === "win32";
  const exe = isWin ? "ffmpeg.exe" : "ffmpeg";

  // 1) Path from ffmpeg-static (may be wrong when bundled)
  try {
    const fromPackage =
      typeof ffmpegStatic === "string"
        ? ffmpegStatic
        : (ffmpegStatic as unknown as { path?: string })?.path;
    if (fromPackage && fsSync.existsSync(fromPackage)) return fromPackage;
  } catch {
    // ignore
  }

  // 2) Explicit node_modules path (works when running from project root)
  const fromNodeModules = path.join(process.cwd(), "node_modules", "ffmpeg-static", exe);
  if (fsSync.existsSync(fromNodeModules)) return fromNodeModules;

  // 3) System ffmpeg on PATH
  return "ffmpeg";
}

/**
 * Create an MP4 buffer: one image (9:16) shown for the duration of the audio.
 * imageBuffer: PNG/JPEG buffer; audioBuffer: MP3 buffer.
 */
export async function composeReelVideo(
  imageBuffer: Buffer,
  audioBuffer: Buffer
): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const id = `reel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const imagePath = path.join(tmpDir, `${id}_image.png`);
  const audioPath = path.join(tmpDir, `${id}_audio.mp3`);
  const outPath = path.join(tmpDir, `${id}_out.mp4`);
  const ffmpegPath = getFfmpegPath();

  try {
    await fs.writeFile(imagePath, imageBuffer);
    await fs.writeFile(audioPath, audioBuffer);

    await new Promise<void>((resolve, reject) => {
      const args = [
        "-y",
        "-loop", "1",
        "-i", imagePath,
        "-i", audioPath,
        "-c:v", "libx264",
        "-tune", "stillimage",
        "-shortest",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        outPath,
      ];
      const proc = spawn(ffmpegPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      let stderr = "";
      proc.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
      });
      proc.on("error", reject);
    });

    const videoBuffer = await fs.readFile(outPath);
    return videoBuffer;
  } finally {
    await fs.unlink(imagePath).catch(() => {});
    await fs.unlink(audioPath).catch(() => {});
    await fs.unlink(outPath).catch(() => {});
  }
}

/**
 * Download MP3 and MP4 to temp files, then put them together into one MP4 (video + voice).
 * Used after video generation: we have the MP4 from MiniMax and the MP3 voiceover; mux with ffmpeg.
 */
export async function composeVideoWithAudio(videoBuffer: Buffer, audioBuffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const id = `mux_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const videoPath = path.join(tmpDir, `${id}_video.mp4`);
  const audioPath = path.join(tmpDir, `${id}_audio.mp3`);
  const outPath = path.join(tmpDir, `${id}_out.mp4`);
  const ffmpegPath = getFfmpegPath();

  try {
    // Download / write MP4 and MP3 to disk, then put them together
    await fs.writeFile(videoPath, videoBuffer);
    await fs.writeFile(audioPath, audioBuffer);

    await new Promise<void>((resolve, reject) => {
      const args = [
        "-y",
        "-i", videoPath,
        "-i", audioPath,
        "-c:v", "copy",
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-shortest",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        outPath,
      ];
      const proc = spawn(ffmpegPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      let stderr = "";
      proc.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg mux exited ${code}: ${stderr.slice(-500)}`));
      });
      proc.on("error", reject);
    });

    const outBuffer = await fs.readFile(outPath);
    return outBuffer;
  } finally {
    await fs.unlink(videoPath).catch(() => {});
    await fs.unlink(audioPath).catch(() => {});
    await fs.unlink(outPath).catch(() => {});
  }
}
