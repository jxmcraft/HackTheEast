import { NextResponse } from "next/server";
import { generateEmbedding, EMBEDDING_DIM } from "@/lib/embeddings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/embedding-test
 * Verifies embedding provider: local (default), or OpenAI when EMBEDDING_PROVIDER=openai.
 */
export async function GET() {
  try {
    const testText = "Embedding test from HTE.";
    const embedding = await generateEmbedding(testText);
    const dimensions = embedding?.length ?? 0;
    const ok = dimensions === EMBEDDING_DIM && Array.isArray(embedding);
    return NextResponse.json({
      ok,
      dimensions,
      expectedDimensions: EMBEDDING_DIM,
      message: ok
        ? "Embedding provider is working."
        : `Unexpected dimensions: got ${dimensions}, expected ${EMBEDDING_DIM}.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Embedding test failed";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
