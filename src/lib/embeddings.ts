/**
 * Embeddings: local in-process model by default (Transformers.js / Xenova all-MiniLM-L6-v2).
 * No API keys or separate server — model loads on first use when you run the app.
 * Set EMBEDDING_PROVIDER=openai (and OPENAI_EMBEDDING_API_KEY) to use OpenAI instead.
 */

import { embedLocal, embedLocalBatch, LOCAL_EMBED_DIM } from "./embeddings-local";

const DEFAULT_DIM = LOCAL_EMBED_DIM; // 384 for local model
const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BACKOFF_MS = 2000;
/** Max texts per batch for embedding APIs. */
const EMBED_BATCH_SIZE = 32;

/** Use local in-process embeddings (default). No separate commands — model loads when server runs. */
function isLocalEmbedding(): boolean {
  const p = process.env.EMBEDDING_PROVIDER?.toLowerCase();
  return p !== "openai" && p !== "minimax"; // default to local when unset or "local"
}

function getLiteLLMConfig(): { baseURL: string; apiKey: string; model: string } {
  const base = process.env.LITELLM_EMBEDDING_API_BASE ?? "";
  const key = process.env.LITELLM_EMBEDDING_API_KEY ?? "";
  const model = process.env.LITELLM_EMBEDDING_MODEL ?? "minimax-embed";
  if (!base || !key) {
    throw new Error(
      "For proxy-based embeddings set LITELLM_EMBEDDING_API_BASE and LITELLM_EMBEDDING_API_KEY. Or use local embeddings (default)."
    );
  }
  return { baseURL: base.replace(/\/$/, ""), apiKey: key, model };
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
      "Minimax embedding: rate limit exceeded (1002). Falling back to OpenAI or proxy."
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
  const model = process.env.LITELLM_EMBEDDING_MODEL ?? "minimax-embed";
  const minimax = model === "minimax-embed" ? getMinimaxDirectConfig() : null;
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
  const { baseURL, apiKey, model: proxyModel } = getLiteLLMConfig();
  const url = `${baseURL}/v1/embeddings`;
  let res: { data?: Array<{ embedding?: unknown }>; [k: string]: unknown } | undefined;
  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RATE_LIMIT_BACKOFF_MS * Math.pow(2, attempt - 1));
    }
    debugLog("LiteLLM", "request", {
      url,
      method: "POST",
      model: proxyModel,
      attempt: attempt + 1,
      headers: { Authorization: maskKey(apiKey) },
    });
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: proxyModel,
          input: text.slice(0, 8_000),
        }),
      });
      const bodyText = await response.text();
      debugLog("LiteLLM", "response", {
        status: response.status,
        ok: response.ok,
        bodyPreview: truncate(bodyText),
      });
      if (response.status === 429 && attempt < RATE_LIMIT_RETRIES) continue;
      if (!response.ok) {
        const is404 = response.status === 404;
        const bodySaysEmbeddingRoute = bodyText.includes("embeddings") && bodyText.includes("not found");
        const openaiKey = process.env.OPENAI_EMBEDDING_API_KEY;
        if (is404 && bodySaysEmbeddingRoute && openaiKey) {
          const openaiUrl = (process.env.OPENAI_API_BASE ?? "https://api.openai.com").replace(/\/$/, "") + "/v1/embeddings";
          debugLog("OpenAI", "request", { url: openaiUrl, method: "POST", note: "fallback from LiteLLM 404" });
          const openaiRes = await fetch(openaiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model: OPENAI_EMBED_MODEL,
              input: text.slice(0, 8_000),
            }),
          });
          const openaiText = await openaiRes.text();
          debugLog("OpenAI", "response", { status: openaiRes.status, ok: openaiRes.ok, bodyPreview: truncate(openaiText) });
          if (openaiRes.ok) {
            const openaiJson = JSON.parse(openaiText) as { data?: Array<{ embedding?: unknown }> };
            const vec = openaiJson.data?.[0]?.embedding;
            if (Array.isArray(vec) && vec.length > 0 && typeof vec[0] === "number") {
              return vec as number[];
            }
          }
        }
        if (is404 && bodySaysEmbeddingRoute) {
          throw new Error(
            "Proxy returned 404 for embeddings. Use MiniMax for embeddings: set MINIMAX_API_KEY and MINIMAX_GROUP_ID (no proxy needed). Or set OPENAI_EMBEDDING_API_KEY for fallback. Featherless does not support embeddings."
          );
        }
        throw new Error(`${response.status} ${response.statusText}${bodyText ? `: ${bodyText.slice(0, 300)}` : ""}`);
      }
      res = JSON.parse(bodyText) as NonNullable<typeof res>;
      break;
    } catch (err) {
      if (attempt === RATE_LIMIT_RETRIES) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`LiteLLM embeddings request failed: ${msg}`);
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("429") && !msg.includes("Rate limit")) throw new Error(`LiteLLM embeddings request failed: ${msg}`);
    }
  }
  if (res == null) {
    throw new Error("LiteLLM embeddings: failed after rate limit retries");
  }

  // Some proxies return data as a JSON string; normalize to array/object
  if (typeof res.data === "string") {
    try {
      (res as { data?: unknown }).data = JSON.parse(res.data as string);
    } catch {
      // leave as-is
    }
  }

  // OpenAI shape: { data: [ { embedding: number[] } ] }
  const vec = res.data?.[0]?.embedding;
  if (Array.isArray(vec) && vec.length > 0 && typeof vec[0] === "number") {
    return vec as number[];
  }

  // data[0] might be the vector itself (e.g. data: [[0.1, 0.2, ...]])
  const first = res.data?.[0];
  if (Array.isArray(first) && first.length > 0) {
    const firstEl = first[0];
    if (typeof firstEl === "number") return first as number[];
    if (typeof firstEl === "string" && !Number.isNaN(Number(firstEl))) {
      return first.map((x) => (typeof x === "number" ? x : Number(x))) as number[];
    }
  }

  // data[0] might use a different key (e.g. vectors, embedding in nested form)
  if (first && typeof first === "object" && !Array.isArray(first)) {
    const obj = first as Record<string, unknown>;
    for (const key of ["embedding", "embeddings", "vector", "vectors"]) {
      const v = obj[key];
      if (Array.isArray(v) && v.length > 0) {
        const arr = v.length === 1 ? (v[0] as unknown) : v;
        if (Array.isArray(arr) && typeof arr[0] === "number") return arr as number[];
        if (typeof arr === "number" || (Array.isArray(arr) && arr.every((x) => typeof x === "number")))
          return Array.isArray(arr) ? (arr as number[]) : [arr as number];
      }
    }
  }

  // Minimax/LiteLLM: data[0] may have nested structure; try data array as raw vectors
  if (res.data && Array.isArray(res.data) && res.data.length > 0) {
    const entry = res.data[0];
    if (Array.isArray(entry) && entry.length > 0 && typeof entry[0] === "number") return entry as number[];
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const o = entry as Record<string, unknown>;
      const raw = o.embedding ?? o.vectors ?? o.vector;
      if (Array.isArray(raw)) {
        const flat = raw.length === 1 ? (raw[0] as unknown) : raw;
        if (Array.isArray(flat) && flat.length > 0 && typeof flat[0] === "number") return flat as number[];
      }
    }
  }

  // Alternative: single object with embedding array
  const alt = (res as { embedding?: unknown }).embedding;
  if (Array.isArray(alt) && alt.length > 0 && typeof alt[0] === "number") {
    return alt as number[];
  }

  // Top-level embedding/vectors (some APIs put vector at root)
  const root = res as Record<string, unknown>;
  for (const key of ["embedding", "embeddings", "vector", "vectors", "output"]) {
    const v = root[key];
    if (Array.isArray(v) && v.length > 0) {
      const item = v[0];
      if (Array.isArray(item) && item.length > 0 && (typeof item[0] === "number" || (typeof item[0] === "string" && !Number.isNaN(Number(item[0]))))) {
        return item.map((x) => (typeof x === "number" ? x : Number(x))) as number[];
      }
      if (typeof item === "number" || (typeof item === "string" && !Number.isNaN(Number(item)))) {
        return v.map((x) => (typeof x === "number" ? x : Number(x))) as number[];
      }
    }
  }

  // When data is null, try usage or other top-level objects (LiteLLM/Minimax may nest embedding here)
  if (res.data == null) {
    const usage = res.usage as Record<string, unknown> | undefined;
    if (usage && typeof usage === "object" && !Array.isArray(usage)) {
      for (const key of ["embedding", "embeddings", "vector", "vectors", "data"]) {
        const v = usage[key];
        if (Array.isArray(v) && v.length > 0) {
          const item = v[0];
          if (Array.isArray(item) && item.length > 0 && (typeof item[0] === "number" || (typeof item[0] === "string" && !Number.isNaN(Number(item[0]))))) {
            return item.map((x) => (typeof x === "number" ? x : Number(x))) as number[];
          }
          if (typeof item === "number" || (typeof item === "string" && !Number.isNaN(Number(item)))) {
            return v.map((x) => (typeof x === "number" ? x : Number(x))) as number[];
          }
        }
      }
    }
  }

  // Minimax/LiteLLM: data may be an object (not array) with embedding/vectors inside
  const dataObj = res.data as Record<string, unknown> | undefined;
  if (dataObj && typeof dataObj === "object" && !Array.isArray(dataObj)) {
    for (const key of ["embedding", "embeddings", "vector", "vectors", "data"]) {
      const v = dataObj[key];
      if (!Array.isArray(v) || v.length === 0) continue;
      const item = v[0];
      if (Array.isArray(item) && item.length > 0) {
        const num = typeof item[0] === "number" ? item[0] : Number(item[0]);
        if (!Number.isNaN(num)) return item.map((x) => (typeof x === "number" ? x : Number(x))) as number[];
      }
      if (typeof item === "number" || (typeof item === "string" && !Number.isNaN(Number(item)))) {
        return v.map((x) => (typeof x === "number" ? x : Number(x))) as number[];
      }
    }
  }

  // Help debug: include data[0] keys if present
  const data0Keys =
    res?.data && Array.isArray(res.data) && res.data[0] && typeof res.data[0] === "object"
      ? Object.keys(res.data[0] as object).join(", ")
      : res?.data
        ? `data.length=${(res.data as unknown[]).length}`
        : null;
  const shape = data0Keys ?? (res && typeof res === "object" ? Object.keys(res).join(", ") : String(res));
  throw new Error(
    `LiteLLM embeddings: empty or invalid response (model=${proxyModel}, response: ${shape}). Check proxy and model compatibility; ensure LITELLM_EMBEDDING_MODEL matches a model in litellm/config.yaml with mode: embedding.`
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

  const model = process.env.LITELLM_EMBEDDING_MODEL ?? "minimax-embed";
  const minimax = model === "minimax-embed" ? getMinimaxDirectConfig() : null;
  const openaiKey = process.env.OPENAI_EMBEDDING_API_KEY;

  const runChunk = async (chunk: string[]): Promise<number[][]> => {
    if (chunk.length === 0) return [];
    if (isLocalEmbedding()) {
      return embedLocalBatch(chunk);
    }
    // Prefer OpenAI when EMBEDDING_PROVIDER=openai (avoids MiniMax rate limits).
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
    const { baseURL, apiKey, model: proxyModel } = getLiteLLMConfig();
    if (proxyModel === "featherless-embed" && openaiKey) {
      return await generateEmbeddingOpenAIDirectBatch(chunk);
    }
    if (proxyModel === "featherless-embed") {
      throw new Error(
        "featherless-embed does not support /v1/embeddings. Set LITELLM_EMBEDDING_MODEL=minimax-embed or OPENAI_EMBEDDING_API_KEY for embeddings."
      );
    }
    const url = `${baseURL}/v1/embeddings`;
    for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
      if (attempt > 0) {
        await sleep(RATE_LIMIT_BACKOFF_MS * Math.pow(2, attempt - 1));
      }
      debugLog("LiteLLM", "request", {
        url,
        method: "POST",
        model: proxyModel,
        attempt: attempt + 1,
        chunkSize: chunk.length,
        headers: { Authorization: maskKey(apiKey) },
      });
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: proxyModel,
          input: chunk.map((t) => t.slice(0, 8_000)),
        }),
      });
      const bodyText = await res.text();
      debugLog("LiteLLM", "response", {
        status: res.status,
        ok: res.ok,
        bodyPreview: truncate(bodyText),
      });
      if (res.status === 404 && bodyText.includes("embeddings") && bodyText.includes("not found") && openaiKey) {
        return await generateEmbeddingOpenAIDirectBatch(chunk);
      }
      if (res.status === 429 && attempt < RATE_LIMIT_RETRIES) continue;
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}${bodyText ? `: ${bodyText.slice(0, 300)}` : ""}`);
      }
      const data = JSON.parse(bodyText) as { data?: Array<{ embedding?: unknown }> };
      const list = data?.data;
      if (!Array.isArray(list) || list.length !== chunk.length) {
        throw new Error(`Proxy returned ${list?.length ?? 0} vectors, expected ${chunk.length}`);
      }
      const out: number[][] = [];
      for (const item of list) {
        const vec = item?.embedding;
        if (Array.isArray(vec) && vec.length > 0 && typeof vec[0] === "number") {
          out.push(vec as number[]);
        } else {
          throw new Error("Proxy embedding: invalid vector shape");
        }
      }
      return out;
    }
    throw new Error("LiteLLM embeddings: failed after rate limit retries");
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
  const model = process.env.LITELLM_EMBEDDING_MODEL ?? "minimax-embed";
  if (model === "minimax-embed" && getMinimaxDirectConfig()) {
    return { model: "minimax-embed", dimensions: DEFAULT_DIM };
  }
  const { model: proxyModel } = getLiteLLMConfig();
  return { model: proxyModel, dimensions: DEFAULT_DIM };
}

export const EMBEDDING_DIM = DEFAULT_DIM;