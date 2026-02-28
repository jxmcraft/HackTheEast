/**
 * All LLM requests go through LiteLLM proxy (OpenAI-compatible embeddings).
 * Proxy exposes POST /embeddings (no /v1 prefix). Minimax/Featherless in litellm/config.yaml.
 */

const DEFAULT_DIM = 1536;

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
  let res: { data?: Array<{ embedding?: unknown }>; [k: string]: unknown };
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
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${response.status} ${response.statusText}${body ? `: ${body.slice(0, 300)}` : ""}`);
    }
    res = (await response.json()) as typeof res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`LiteLLM embeddings request failed: ${msg}`);
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