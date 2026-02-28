/**
 * All LLM requests go through LiteLLM proxy (OpenAI-compatible embeddings).
 * Proxy exposes POST /embeddings (no /v1 prefix). Minimax/Featherless in litellm/config.yaml.
 */

const DEFAULT_DIM = 1536;
const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BACKOFF_MS = 2000;

function getLiteLLMConfig(): { baseURL: string; apiKey: string; model: string } {
  const base = process.env.LITELLM_EMBEDDING_API_BASE ?? "";
  const key = process.env.LITELLM_EMBEDDING_API_KEY ?? "";
  const model = process.env.LITELLM_EMBEDDING_MODEL ?? "featherless-embed";
  if (!base || !key) {
    throw new Error(
      "LiteLLM: set LITELLM_EMBEDDING_API_BASE and LITELLM_EMBEDDING_API_KEY in env (proxy must be running)"
    );
  }
  return { baseURL: base.replace(/\/$/, ""), apiKey: key, model };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Generate embedding for one text via LiteLLM proxy.
 * Uses POST /embeddings (proxy path; not /v1/embeddings).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text?.trim()) {
    throw new Error("generateEmbedding: text is required");
  }
  const { baseURL, apiKey, model } = getLiteLLMConfig();
  const url = `${baseURL}/embeddings`;
  let res: { data?: Array<{ embedding?: unknown }>; [k: string]: unknown } | undefined;
  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RATE_LIMIT_BACKOFF_MS * Math.pow(2, attempt - 1));
    }
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: text.slice(0, 8_000),
        }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      const bodyText = await response.text();
      // #region agent log
      if (contentType.indexOf("json") === -1 || bodyText.trimStart().startsWith("<")) fetch('http://127.0.0.1:7816/ingest/dcfe79ee-b938-4a53-8e78-211d2e2b322f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1f53d4'},body:JSON.stringify({sessionId:'1f53d4',hypothesisId:'H3',location:'embeddings.ts:generateEmbedding',message:'LiteLLM response not JSON',data:{status:response.status,contentType,bodyPreview:bodyText.slice(0,150)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (response.status === 429 && attempt < RATE_LIMIT_RETRIES) continue;
      if (!response.ok) {
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

  // OpenAI shape: { data: [ { embedding: number[] } ] }
  let vec = res.data?.[0]?.embedding;
  if (Array.isArray(vec) && vec.length > 0 && typeof vec[0] === "number") {
    return vec as number[];
  }

  // data[0] might be the vector itself (e.g. data: [[0.1, 0.2, ...]])
  const first = res.data?.[0];
  if (Array.isArray(first) && first.length > 0 && typeof first[0] === "number") {
    return first as number[];
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

  // Alternative: single object with embedding array
  const alt = (res as { embedding?: unknown }).embedding;
  if (Array.isArray(alt) && alt.length > 0 && typeof alt[0] === "number") {
    return alt as number[];
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
    `LiteLLM embeddings: empty or invalid response (model=${model}, response: ${shape}). If using minimax-embed, try featherless-embed (LITELLM_EMBEDDING_MODEL=featherless-embed) or check proxy/Minimax compatibility.`
  );
}

export function getEmbeddingModelConfig(): { model: string; dimensions: number } {
  const { model } = getLiteLLMConfig();
  return { model, dimensions: DEFAULT_DIM };
}

export const EMBEDDING_DIM = DEFAULT_DIM;