/**
 * Create the lesson-audio storage bucket in Supabase (for Phase 3 audio-visual lessons).
 * Run from project root: bun run scripts/create-lesson-audio-bucket.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env or .env.local.
 */
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "lesson-audio";

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

  const { data, error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: "50MB",
    allowedMimeTypes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/webm"],
  });

  if (error) {
    const msg = (error as { message?: string }).message ?? String(error);
    if (msg.includes("already exists") || msg.includes("duplicate")) {
      console.log(`Bucket "${BUCKET}" already exists.`);
      return;
    }
    throw error;
  }

  console.log(`Bucket "${BUCKET}" created.`, data ?? "");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
