/**
 * Ensure LiteLLM proxy is installed (pip install 'litellm[proxy]').
 * Run automatically via postinstall, or manually: bun run setup-litellm
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");

function run(cmd: string, args: string[]): { ok: boolean; out: string; err: string } {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    cwd: root,
  });
  return {
    ok: r.status === 0,
    out: (r.stdout ?? "").trim(),
    err: (r.stderr ?? "").trim(),
  };
}

function litellmInstalled(): boolean {
  const { ok } = run("litellm", ["--version"]);
  return ok;
}

function getPipCommand(): { cmd: string; args: string[] } | null {
  const candidates: [string, string[], string[]][] = [
    ["python", ["-m", "pip", "install", "litellm[proxy]"], ["-m", "pip", "--version"]],
    ["python3", ["-m", "pip", "install", "litellm[proxy]"], ["-m", "pip", "--version"]],
    ["py", ["-m", "pip", "install", "litellm[proxy]"], ["-m", "pip", "--version"]],
    ["pip", ["install", "litellm[proxy]"], ["--version"]],
    ["pip3", ["install", "litellm[proxy]"], ["--version"]],
  ];
  for (const [cmd, installArgs, checkArgs] of candidates) {
    const { ok } = run(cmd, checkArgs);
    if (ok) return { cmd, args: installArgs };
  }
  return null;
}

function main(): void {
  if (litellmInstalled()) {
    console.log("LiteLLM already installed.");
    return;
  }

  const pip = getPipCommand();
  if (!pip) {
    console.error(
      "LiteLLM is not installed and no pip found. Install Python and pip, then run:\n  pip install 'litellm[proxy]'\nOr run this script again after adding Python to PATH."
    );
    process.exit(1);
  }

  console.log("Installing LiteLLM proxy...");
  const { ok, out, err } = run(pip.cmd, pip.args);
  if (ok) {
    console.log(out || "LiteLLM installed successfully.");
    return;
  }
  console.error("Failed to install LiteLLM:", err || out);
  process.exit(1);
}

main();
