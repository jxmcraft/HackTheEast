/**
 * In-process local embeddings for RAG.
 * No API keys or separate server — model loads on first use when you run the app.
 * Uses all-MiniLM-L6-v2 (384 dimensions), small and fast.
 *
 * If you see "Deserialize tensor ... GetExtDataFromTensorProto ... out of bounds", the model cache
 * is incomplete or corrupted. Clear the cache (project `.cache` when env.cacheDir is set below, or
 * `node_modules/@huggingface/transformers/.cache`) and restart.
 */

import path from "node:path";
import os from "node:os";

export const LOCAL_EMBED_DIM = 384;
const MODEL_ID = "onnx-community/all-MiniLM-L6-v2-ONNX";
const MAX_TEXT_LENGTH = 8_192;

/** Project-scoped cache so one place to clear; safe in Node/Next server. On Vercel/serverless, use tmpdir (read-only fs). */
function setCacheDir(env: { cacheDir?: string }): void {
  if (typeof process === "undefined" || !env) return;
  try {
    // Vercel (and similar serverless) have read-only /var/task; use writable /tmp
    const useTmp = !!process.env.VERCEL || process.cwd() === "/var/task";
    env.cacheDir = useTmp
      ? path.join(os.tmpdir(), "transformers-cache")
      : path.join(process.cwd(), ".cache");
  } catch {
    /* ignore */
  }
}

/** Matches ONNX external-data read errors (incomplete/corrupt cache). */
function isOnnxCacheError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return /GetExtDataFromTensorProto|out of bounds|are out of bounds/i.test(message);
}

let pipelinePromise: Promise<(input: string | string[], options?: { pooling?: string; normalize?: boolean }) => Promise<{ data: Float32Array; dims: number[] }>> | null = null;

function getPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      setCacheDir(env);
      try {
        const pipe = await pipeline("feature-extraction", MODEL_ID, {
          dtype: "fp32",
        });
        return pipe as (input: string | string[], options?: { pooling?: string; normalize?: boolean }) => Promise<{ data: Float32Array; dims: number[] }>;
      } catch (e) {
        const isCache = isOnnxCacheError(e);
        if (isCache) {
          pipelinePromise = null;
          console.warn("[embed:local] Model load failed (likely incomplete/corrupt cache). Clear the cache directory (project .cache or node_modules/@huggingface/transformers/.cache) and restart.");
        }
        throw e;
      }
    })();
  }
  return pipelinePromise;
}

/**
 * Embed a single text. Loads model on first call.
 */
export async function embedLocal(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const truncated = text.slice(0, MAX_TEXT_LENGTH).replace(/\n/g, " ").trim() || " ";
  const out = await pipe(truncated, { pooling: "mean", normalize: true });
  const data = (out as { data: Float32Array; dims?: number[] }).data;
  const dims = (out as { dims?: number[] }).dims;
  const dim = (dims && dims.length >= 2) ? dims[1] : LOCAL_EMBED_DIM;
  return Array.from(data.slice(0, dim));
}

/**
 * Embed multiple texts in one forward pass. Loads model on first call.
 */
export async function embedLocalBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const pipe = await getPipeline();
  const inputs = texts.map((t) => t.slice(0, MAX_TEXT_LENGTH).replace(/\n/g, " ").trim() || " ");
  const out = await pipe(inputs, { pooling: "mean", normalize: true });
  const data = (out as { data: Float32Array }).data;
  const dims = (out as { dims?: number[] }).dims ?? [inputs.length, LOCAL_EMBED_DIM];
  const batchSize = dims[0];
  const dim = dims[1] ?? LOCAL_EMBED_DIM;
  const results: number[][] = [];
  for (let i = 0; i < batchSize; i++) {
    results.push(Array.from(data.slice(i * dim, (i + 1) * dim)));
  }
  return results;
}
