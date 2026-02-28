/**
 * Embeddings: local in-process model by default (Transformers.js / Xenova all-MiniLM-L6-v2).
 * Set EMBEDDING_PROVIDER=openai (and OPENAI_EMBEDDING_API_KEY) for OpenAI, or EMBEDDING_PROVIDER=minimax
 * with MINIMAX_API_KEY and MINIMAX_GROUP_ID for MiniMax.
 */

import { embedLocal, embedLocalBatch, LOCAL_EMBED_DIM } from "./embeddings-local";

const DEFAULT_DIM = LOCAL_EMBED_DIM; // 384 for local model
const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BACKOFF_MS = 2000;
/** Max texts per batch for embedding APIs. */
const EMBED_BATCH_SIZE = 32;

/** Use local in-process embeddings (default). */
function isLocalEmbedding(): boolean {
  const p = process.env.EMBEDDING_PROVIDER?.toLowerCase();
  return p !== "openai" && p !== "minimax"; // default to local when unset or "local"
}

/** Truncate string for debug logs; never log full API keys. */
const TRUNCATE = 600;
function maskKey(key: string): string {
  if (!key || key.length <= 8) return "***";
  return `***${key.slice(-4)}`;
}
function truncate(s: string, max: number = TRUNCATE): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `...(${s.length - max} more)`;
}
function debugLog(service: string, kind: "request" | "response", payload: Record<string, unknown>): void {
  try {
    console.warn(`[embed:${service}] ${kind}`, JSON.stringify(payload));
  } catch {
    console.warn(`[embed:${service}] ${kind}`, String(payload));
  }
}

const MINIMAX_EMBED_BASE = (process.env.MINIMAX_EMBEDDING_API_BASE ?? "https://api.minimax.chat/v1").replace(/\/$/, "");
const MINIMAX_EMBED_MODEL = "embo-01";
function preferOpenAIEmbedding(): boolean {
  const p = process.env.EMBEDDING_PROVIDER?.toLowerCase();
  return p === "openai" && !!process.env.OPENAI_EMBEDDING_API_KEY;
}
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

function getMinimaxDirectConfig(): { apiKey: string; groupId: string } | null {
  const apiKey = process.env.MINIMAX_API_KEY;
  const groupId = process.env.MINIMAX_GROUP_ID;
  if (!apiKey?.trim() || !groupId?.trim()) return null;
  return { apiKey, groupId };
}

/** Minimax native batch: body { model, texts, type }. Returns vectors[]. On rate limit (1002) throws. */
async function generateEmbeddingMinimaxDirectBatch(
  texts: string[],
  config: { apiKey: string; groupId: string },
  type: "db" | "query" = "db"
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const url = `${MINIMAX_EMBED_BASE}/embeddings?GroupId=${encodeURIComponent(config.groupId)}`;
  const inputs = texts.map((t) => t.slice(0, 8_000).replace(/\n/g, " "));
  const body = { model: MINIMAX_EMBED_MODEL, texts: inputs, type };
  debugLog("Minimax", "request", {
    url,
    method: "POST",
    headers: { Authorization: maskKey(config.apiKey), "Group-Id": config.groupId },
    bodyKeys: Object.keys(body),
    textCount: inputs.length,
    bodyPreview: truncate(JSON.stringify(body)),
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "Group-Id": config.groupId,
    },
    body: JSON.stringify(body),
  });
  const bodyText = await res.text();
  debugLog("Minimax", "response", {
    status: res.status,
    ok: res.ok,
    bodyPreview: truncate(bodyText),
    bodyLength: bodyText.length,
  });
  if (!res.ok) {
    throw new Error(
      `Minimax embedding API error ${res.status}: ${bodyText.slice(0, 300)}`
    );
  }
  const data = JSON.parse(bodyText) as {
    vectors?: number[][] | null;
    data?: Array<{ embedding?: number[] }>;
    base_resp?: { status_code?: number; status_msg?: string };
  };
  const statusCode = data?.base_resp?.status_code;
  const statusMsg = data?.base_resp?.status_msg ?? "";

  debugLog("Minimax", "response", {
    parsed: {
      hasVectors: Array.isArray(data?.vectors),
      vectorsLength: Array.isArray(data?.vectors) ? data.vectors.length : 0,
      hasData: Array.isArray(data?.data),
      dataLength: Array.isArray(data?.data) ? data.data.length : 0,
      base_resp: data?.base_resp,
    },
  });

  // Accept native shape (vectors) or OpenAI-style (data[].embedding)
  let vectors: number[][] | null = null;
  if (Array.isArray(data?.vectors) && data.vectors.length > 0) {
    vectors = data.vectors;
  } else if (Array.isArray(data?.data) && data.data.length > 0) {
    const out: number[][] = [];
    for (const item of data.data) {
      const emb = item?.embedding;
      if (Array.isArray(emb) && emb.length > 0 && typeof emb[0] === "number") {
        out.push(emb);
      } else {
        out.length = 0;
        break;
      }
    }
    if (out.length === data.data.length) vectors = out;
  }

  const hasValidVectors = Array.isArray(vectors) && vectors.length === texts.length;

  // Only treat as rate limit when we have no valid vectors and API says 1002
  if (statusCode === 1002 && !hasValidVectors) {
    throw new Error(
      "Minimax embedding: rate limit exceeded (1002). Set OPENAI_EMBEDDING_API_KEY for fallback or retry later."
    );
  }
  if (statusCode != null && statusCode !== 0 && !hasValidVectors) {
    const hint =
      statusCode === 2049
        ? " If your key is from platform.minimax.io, try setting MINIMAX_EMBEDDING_API_BASE=https://api.minimax.io/v1 in .env."
        : "";
    throw new Error(
      `Minimax embedding API error (${statusCode}): ${statusMsg || "see base_resp in response"}. Check MINIMAX_API_KEY and MINIMAX_GROUP_ID.${hint}`
    );
  }
  if (!hasValidVectors) {
    throw new Error(
      `Minimax embedding: unexpected response (missing vectors). ${bodyText.slice(0, 200)}`
    );
  }
  for (const vec of vectors!) {
    if (!Array.isArray(vec) || vec.length === 0 || typeof vec[0] !== "number") {
      throw new Error("Minimax embedding: invalid vector shape");
    }
  }
  return vectors as number[][];
}

async function generateEmbeddingMinimaxDirect(
  text: string,
  config: { apiKey: string; groupId: string },
  type: "db" | "query" = "db"
): Promise<number[]> {
  const vectors = await generateEmbeddingMinimaxDirectBatch([text], config, type);
  return vectors[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** OpenAI-compatible /v1/embeddings with input as string[]; returns vectors[]. */
async function generateEmbeddingOpenAIDirectBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const apiKey = process.env.OPENAI_EMBEDDING_API_KEY;
  const base = (process.env.OPENAI_API_BASE ?? "https://api.openai.com").replace(/\/$/, "");
  if (!apiKey) throw new Error("OPENAI_EMBEDDING_API_KEY is not set");
  const url = `${base}/v1/embeddings`;
  const input = texts.map((t) => t.slice(0, 8_000));
  debugLog("OpenAI", "request", {
    url,
    method: "POST",
    headers: { Authorization: maskKey(apiKey) },
    bodyKeys: ["model", "input"],
    textCount: input.length,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBED_MODEL,
      input,
    }),
  });
  const bodyText = await res.text();
  debugLog("OpenAI", "response", {
    status: res.status,
    ok: res.ok,
    bodyPreview: truncate(bodyText),
  });
  if (!res.ok) {
    throw new Error(`OpenAI embedding error ${res.status}: ${bodyText.slice(0, 300)}`);
  }
  const data = JSON.parse(bodyText) as { data?: Array<{ embedding?: unknown }> };
  const list = data?.data;
  if (!Array.isArray(list) || list.length !== texts.length) {
    throw new Error(`OpenAI embedding: expected ${texts.length} vectors, got ${list?.length ?? 0}`);
  }
  const out: number[][] = [];
  for (const item of list) {
    const vec = item?.embedding;
    if (Array.isArray(vec) && vec.length > 0 && typeof vec[0] === "number") {
      out.push(vec as number[]);
    } else {
      throw new Error("OpenAI embedding: invalid vector shape");
    }
  }
  return out;
}

/**
 * Generate embedding for one text.
 * Uses local in-process model by default (no API keys). Set EMBEDDING_PROVIDER=openai for OpenAI.
 */
export async function generateEmbedding(text: string, type: "db" | "query" = "db"): Promise<number[]> {
  if (!text?.trim()) {
    throw new Error("generateEmbedding: text is required");
  }
  if (isLocalEmbedding()) {
    return embedLocal(text);
  }
  // Prefer OpenAI when EMBEDDING_PROVIDER=openai and key set.
  if (preferOpenAIEmbedding()) {
    const vecs = await generateEmbeddingOpenAIDirectBatch([text]);
    if (vecs.length > 0) return vecs[0];
    throw new Error("OpenAI embedding returned no vector");
  }
  const minimax = getMinimaxDirectConfig();
  if (minimax) {
    try {
      const vec = await generateEmbeddingMinimaxDirect(text, minimax, type);
      if (vec) return vec;
    } catch (_directErr) {
      const openaiKey = process.env.OPENAI_EMBEDDING_API_KEY;
      if (openaiKey) {
        try {
          const vecs = await generateEmbeddingOpenAIDirectBatch([text]);
          if (vecs.length > 0) return vecs[0];
        } catch {
          // ignore, rethrow original
        }
      }
      throw _directErr;
    }
  }
  throw new Error(
    "Embeddings: set EMBEDDING_PROVIDER=openai and OPENAI_EMBEDDING_API_KEY, or EMBEDDING_PROVIDER=minimax with MINIMAX_API_KEY and MINIMAX_GROUP_ID, or use local (default)."
  );
}

/**
 * Generate embeddings for multiple texts in batches (same backend as generateEmbedding).
 * Uses batch API where supported to reduce rate limits. Returns one vector per input text in order.
 * For MiniMax: use type "db" when storing documents, "query" for search queries.
 */
export async function generateEmbeddingBatch(texts: string[], type: "db" | "query" = "db"): Promise<number[][]> {
  const valid = texts
    .map((t) => (typeof t === "string" && t.trim() ? t.trim() : null))
    .filter((t): t is string => t !== null);
  if (valid.length === 0) return [];

  const minimax = getMinimaxDirectConfig();
  const openaiKey = process.env.OPENAI_EMBEDDING_API_KEY;

  const runChunk = async (chunk: string[]): Promise<number[][]> => {
    if (chunk.length === 0) return [];
    if (isLocalEmbedding()) {
      return embedLocalBatch(chunk);
    }
    if (preferOpenAIEmbedding()) {
      return await generateEmbeddingOpenAIDirectBatch(chunk);
    }
    if (minimax) {
      let lastErr: unknown;
      const isRateLimit = (e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        return msg.includes("1002") || /rate limit/i.test(msg);
      };
      for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
        if (attempt > 0) {
          await sleep(RATE_LIMIT_BACKOFF_MS * Math.pow(2, attempt - 1));
        }
        try {
          return await generateEmbeddingMinimaxDirectBatch(chunk, minimax, type);
        } catch (err) {
          lastErr = err;
          if (isRateLimit(err) && attempt < RATE_LIMIT_RETRIES) continue;
          if (openaiKey) {
            return await generateEmbeddingOpenAIDirectBatch(chunk);
          }
          const underlying = lastErr instanceof Error ? (lastErr as Error).message : String(lastErr);
          throw new Error(
            `Minimax embedding failed and OPENAI_EMBEDDING_API_KEY is not set for fallback. Cause: ${underlying}`
          );
        }
      }
      const underlying = lastErr instanceof Error ? (lastErr as Error).message : String(lastErr);
      throw new Error(
        `Minimax embedding failed and OPENAI_EMBEDDING_API_KEY is not set for fallback. Cause: ${underlying}`
      );
    }
    throw new Error(
      "Embeddings: set EMBEDDING_PROVIDER=openai and OPENAI_EMBEDDING_API_KEY, or EMBEDDING_PROVIDER=minimax with MINIMAX_API_KEY and MINIMAX_GROUP_ID, or use local (default)."
    );
  };

  const results: number[][] = [];
  for (let i = 0; i < valid.length; i += EMBED_BATCH_SIZE) {
    const chunk = valid.slice(i, i + EMBED_BATCH_SIZE);
    const vectors = await runChunk(chunk);
    results.push(...vectors);
  }
  return results;
}

export function getEmbeddingModelConfig(): { model: string; dimensions: number } {
  if (isLocalEmbedding()) {
    return { model: "local", dimensions: LOCAL_EMBED_DIM };
  }
  if (preferOpenAIEmbedding()) {
    return { model: OPENAI_EMBED_MODEL, dimensions: DEFAULT_DIM };
  }
  if (getMinimaxDirectConfig()) {
    return { model: "minimax-embed", dimensions: DEFAULT_DIM };
  }
  return { model: "minimax-embed", dimensions: DEFAULT_DIM };
}

export const EMBEDDING_DIM = DEFAULT_DIM;