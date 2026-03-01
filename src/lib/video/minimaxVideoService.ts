/**
 * MiniMax text-to-video API for generating Instagram 15-second reels.
 * Uses MINIMAX_API_KEY for video generation. No GroupId.
 * Creates a task, polls until Success, then retrieves the video file.
 */

const MINIMAX_BASE = "https://api.minimax.io";
const VIDEO_MODEL = process.env.MINIMAX_VIDEO_MODEL ?? "MiniMax-Hailuo-2.3";
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_WAIT_MS = 300_000; // 5 min

function getApiKey(): string {
  const key = process.env.MINIMAX_API_KEY;
  if (!key?.trim()) {
    throw new Error("MINIMAX_API_KEY is required for video generation.");
  }
  return key;
}

type CreateTaskResp = {
  task_id?: string;
  base_resp?: { status_code?: number; status_msg?: string };
};

type QueryResp = {
  task_id?: string;
  status?: string;
  file_id?: string;
  video_width?: number;
  video_height?: number;
  error_message?: string;
  base_resp?: { status_code?: number; status_msg?: string };
};

type RetrieveResp = {
  file?: { download_url?: string };
  base_resp?: { status_code?: number };
};

/**
 * Create a text-to-video generation task. Returns task_id.
 */
export async function createVideoTask(prompt: string, options?: { duration?: number; resolution?: string }): Promise<string> {
  const apiKey = getApiKey();
  const url = `${MINIMAX_BASE}/v1/video_generation`;
  const body = {
    model: VIDEO_MODEL,
    prompt: prompt.slice(0, 2000),
    duration: options?.duration ?? 10,
    resolution: options?.resolution ?? "768P",
    prompt_optimizer: true,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`MiniMax video create failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const data = JSON.parse(text) as CreateTaskResp;
  if (data.base_resp?.status_code !== 0 && data.base_resp?.status_code !== undefined) {
    throw new Error(`MiniMax video: ${data.base_resp.status_msg ?? "Unknown error"}`);
  }
  const taskId = data.task_id;
  if (!taskId) {
    throw new Error("MiniMax video: no task_id in response");
  }
  return taskId;
}

/**
 * Poll task status until Success or Fail. Returns file_id on success.
 */
export async function pollVideoTask(taskId: string): Promise<string> {
  const apiKey = getApiKey();
  const url = `${MINIMAX_BASE}/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`;
  const start = Date.now();

  while (Date.now() - start < MAX_POLL_WAIT_MS) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`MiniMax video query failed: ${res.status} ${text.slice(0, 200)}`);
    }

    const data = JSON.parse(text) as QueryResp;
    const status = data.status;

    if (status === "Success" && data.file_id) {
      return data.file_id;
    }
    if (status === "Fail") {
      throw new Error(data.error_message ?? "MiniMax video generation failed.");
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error("MiniMax video generation timed out.");
}

/**
 * Retrieve video file by file_id. Returns video buffer (MP4).
 */
export async function retrieveVideoFile(fileId: string): Promise<Buffer> {
  const apiKey = getApiKey();
  const retrieveUrl = `${MINIMAX_BASE}/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`;

  const res = await fetch(retrieveUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`MiniMax file retrieve failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = JSON.parse(text) as RetrieveResp;
  const downloadUrl = data.file?.download_url;
  if (!downloadUrl) {
    throw new Error("MiniMax: no download_url in retrieve response");
  }

  const videoRes = await fetch(downloadUrl);
  if (!videoRes.ok) {
    throw new Error(`MiniMax video download failed: ${videoRes.status}`);
  }
  const arr = await videoRes.arrayBuffer();
  return Buffer.from(arr);
}

/**
 * Full flow: create task, poll until done, return video buffer.
 */
export async function generateVideoFromPrompt(prompt: string, options?: { duration?: number; resolution?: string }): Promise<Buffer> {
  const taskId = await createVideoTask(prompt, options);
  const fileId = await pollVideoTask(taskId);
  return retrieveVideoFile(fileId);
}
