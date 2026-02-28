/**
 * Update the lesson-audio bucket to allow video/mp4 and image MIME types (for Reels).
 * Run once if you get "mime type video/mp4 is not supported" or "image/png is not supported".
 * Run from project root: bun run scripts/update-lesson-audio-bucket-mime.ts
 */
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "lesson-audio";

const ALLOWED_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/webm",
  "video/mp4",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const scriptDir =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));
const scriptRoot = path.resolve(scriptDir, "..");
const cwdRoot = process.cwd();
const root =
  existsSync(path.join(cwdRoot, ".env.local")) || existsSync(path.join(cwdRoot, ".env"))
    ? cwdRoot
    : scriptRoot;

dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing env: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env or .env.local)."
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.storage.updateBucket(BUCKET, {
    public: true,
    fileSizeLimit: "50MB",
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  });

  if (error) {
    throw error;
  }

  console.log(`Bucket "${BUCKET}" updated to allow: ${ALLOWED_MIME_TYPES.join(", ")}.`, data ?? "");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
