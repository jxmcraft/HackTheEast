/**
 * OpenAI-compatible chat completion with retry for rate limits.
 * Prefers Featherless (works in Hong Kong and globally); falls back to OpenAI when configured.
 */

const FEATHERLESS_BASE = "https://api.featherless.ai";
const FEATHERLESS_DEFAULT_MODEL = "Qwen/Qwen2.5-7B-Instruct";
const OPENAI_DEFAULT_MODEL = "gpt-4o";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

type ChatConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
};

function getChatConfig(): ChatConfig {
  const featherlessKey = process.env.FEATHERLESS_API_KEY;
  if (featherlessKey) {
    return {
      apiKey: featherlessKey,
      baseURL: FEATHERLESS_BASE.replace(/\/$/, ""),
      model: process.env.FEATHERLESS_CHAT_MODEL ?? FEATHERLESS_DEFAULT_MODEL,
    };
  }
  const openAIKey = process.env.OPENAI_API_KEY;
  if (openAIKey) {
    const baseURL = process.env.OPENAI_API_BASE?.replace(/\/$/, "");
    return {
      apiKey: openAIKey,
      baseURL: baseURL || "https://api.openai.com",
      model: process.env.OPENAI_CHAT_MODEL ?? OPENAI_DEFAULT_MODEL,
    };
  }
  throw new Error(
    "Set FEATHERLESS_API_KEY in .env.local for lesson generation (works in Hong Kong and globally). " +
    "Alternatively set OPENAI_API_KEY for OpenAI."
  );
}

export async function chatCompletion(params: {
  model?: string;
  system: string;
  user: string;
  temperature?: number;
}): Promise<string> {
  const config = getChatConfig();
  const model = params.model ?? config.model;
  const temperature = params.temperature ?? 0.7;

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${config.baseURL}/v1/chat/completions`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      };
      if (config.baseURL.startsWith(FEATHERLESS_BASE)) {
        headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL ?? "https://github.com/hte";
        headers["X-Title"] = "HTE Study Companion";
      }
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          temperature,
          messages: [
            { role: "system", content: params.system },
            { role: "user", content: params.user },
          ],
        }),
      });

      if (res.status === 429) {
        lastError = new Error("Rate limited. Retrying...");
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
        }
        continue;
      }

      if (!res.ok) {
        const body = await res.text();
        if (res.status === 403) {
          let parsed: { error?: { code?: string } } = {};
          try { parsed = JSON.parse(body) as { error?: { code?: string } }; } catch { }
          if (parsed?.error?.code === "unsupported_country_region_territory") {
            throw new Error(
              "Your region is not supported by this API. Use FEATHERLESS_API_KEY in .env.local for global access (e.g. Hong Kong), or OPENAI_API_BASE with a proxy in a supported region."
            );
          }
        }
        throw new Error(`${res.status} ${res.statusText}${body ? `: ${body.slice(0, 300)}` : ""}`);
      }

      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === "string") return content.trim();
      throw new Error("Empty or invalid chat completion response");
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES && (String(lastError.message).includes("429") || String(lastError.message).includes("rate"))) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error("Chat completion failed after retries");
}
