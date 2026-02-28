import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load .env from project root. Prefer cwd (when run via "bun run" from repo root), else script-relative.
const cwdRoot = process.cwd();
const scriptDir =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));
const scriptRoot = path.resolve(scriptDir, "..");

const root =
  existsSync(path.join(cwdRoot, ".env.local")) ||
  existsSync(path.join(cwdRoot, ".env"))
    ? cwdRoot
    : scriptRoot;

dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL = process.env.EXAMPLE_USER_EMAIL ?? "test@example.com";
const PASSWORD = process.env.EXAMPLE_USER_PASSWORD ?? "ChangeMe123!";
const FULL_NAME = process.env.EXAMPLE_USER_FULL_NAME ?? "Test User";

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing env: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script (e.g. in .env or .env.local)."
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME },
  });

  if (error) {
    const isEmailExists =
      (error as { code?: string }).code === "email_exists" ||
      (error as { status?: number }).status === 422;
    if (isEmailExists) {
      console.log("A user with this email already exists:", EMAIL);
      console.log(
        "Sign in at /login with that email. If you don't know the password, reset it in Supabase Dashboard → Authentication → Users, or set EXAMPLE_USER_EMAIL to create a different user."
      );
      return;
    }
    throw error;
  }

  console.log("Created user:", {
    id: data.user?.id,
    email: data.user?.email,
    full_name: FULL_NAME,
  });
  console.log("Password:", PASSWORD);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

