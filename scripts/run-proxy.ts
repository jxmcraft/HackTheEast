/**
 * Run the LiteLLM proxy with env loaded from .env and .env.local.
 * Usage: bun scripts/run-proxy.ts (or "bun run proxy")
 */
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import dotenv from "dotenv";
import { spawn, spawnSync } from "child_process";

const cwdRoot = process.cwd();
const scriptDir =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");

// Load .env then .env.local (local overrides)
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local") });

const configPath = path.join(root, "litellm", "config.yaml");
if (!existsSync(configPath)) {
  console.error("LiteLLM config not found:", configPath);
  process.exit(1);
}

// Ensure LiteLLM is installed (e.g. if postinstall was skipped)
const check = spawnSync("litellm", ["--version"], { encoding: "utf8" });
if (check.status !== 0) {
  console.log("LiteLLM not found. Running setup...");
  const setup = spawnSync("bun", ["run", "setup-litellm"], {
    encoding: "utf8",
    stdio: "inherit",
    cwd: root,
  });
  if (setup.status !== 0) {
    console.error("Run: bun run setup-litellm");
    process.exit(1);
  }
}

const child = spawn("litellm", ["--config", configPath], {
  env: process.env,
  stdio: "inherit",
  cwd: root,
});

child.on("error", (err) => {
  console.error("Failed to start litellm:", err.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
