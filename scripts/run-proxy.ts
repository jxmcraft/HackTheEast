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

// Run litellm via Python (litellm CLI exe is often not on PATH or blocked on Windows)
const pyCandidates = ["python", "py", "python3"];
let pyCmd: string | null = null;
for (const py of pyCandidates) {
  const check = spawnSync(py, ["-c", "from litellm import run_server; print('ok')"], {
    encoding: "utf8",
    cwd: root,
  });
  if (check.status === 0) {
    pyCmd = py;
    break;
  }
}
if (!pyCmd) {
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
  for (const py of pyCandidates) {
    const check = spawnSync(py, ["-c", "from litellm import run_server; print('ok')"], {
      encoding: "utf8",
      cwd: root,
    });
    if (check.status === 0) {
      pyCmd = py;
      break;
    }
  }
  if (!pyCmd) {
    console.error("LiteLLM still not found after setup. Ensure Python and pip are in PATH.");
    process.exit(1);
  }
}

// Use UTF-8 for config file reading (avoids cp950 decode errors on Windows)
const env = { ...process.env, PYTHONIOENCODING: "utf-8" };
const litellmArgs = `import sys; sys.argv=['litellm','--config','${configPath.replace(/\\/g, "/")}']; from litellm import run_server; run_server()`;

const child = spawn(pyCmd, ["-c", litellmArgs], {
  env,
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
