/**
 * Canvas LMS API client and sync utilities.
 * Requires CANVAS_API_URL (e.g. https://your-school.instructure.com) and CANVAS_ACCESS_TOKEN.
 */

const getCanvasConfig = () => {
  const baseUrl = process.env.CANVAS_API_URL ?? process.env.NEXT_PUBLIC_CANVAS_API_URL;
  const token = process.env.CANVAS_ACCESS_TOKEN ?? process.env.NEXT_PUBLIC_CANVAS_ACCESS_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("Canvas API: set CANVAS_API_URL and CANVAS_ACCESS_TOKEN (or NEXT_PUBLIC_* for client).");
  }
  const apiBase = baseUrl.replace(/\/$/, "") + "/api/v1";
  return { apiBase, token };
};

async function canvasFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const { apiBase, token } = getCanvasConfig();
  const url = new URL(apiBase + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Canvas API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** Paginate through a Canvas list endpoint (Link header). */
async function canvasFetchAll<T>(path: string, params?: Record<string, string>): Promise<T[]> {
  const { apiBase, token } = getCanvasConfig();
  let url: string = apiBase + path;
  if (params) {
    const u = new URL(url);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    url = u.toString();
  }
  const out: T[] = [];
  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Canvas API ${res.status}: ${text || res.statusText}`);
    }
    const data = (await res.json()) as T[] | { next?: string };
    const list = Array.isArray(data) ? data : [];
    out.push(...list);
    const link = res.headers.get("Link");
    const nextMatch = link?.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : "";
  }
  return out;
}

// --- Types (minimal, aligned with Canvas API) ---

export interface CanvasCourse {
  id: number;
  name: string;
  course_code?: string;
  workflow_state?: string;
  start_at?: string | null;
  end_at?: string | null;
}

export interface CanvasCalendarEvent {
  id: number | string;
  title: string;
  start_at: string;
  end_at: string;
  description?: string | null;
  context_code?: string;
  context_name?: string;
  all_day?: boolean;
  workflow_state?: string;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description?: string | null;
  due_at: string | null;
  course_id: number;
  html_url?: string;
  submission_types?: string[];
}

// --- Sync functions ---

/**
 * Fetch all courses the current user is enrolled in (active).
 */
export async function syncCourses(): Promise<CanvasCourse[]> {
  const list = await canvasFetchAll<CanvasCourse>("/courses", {
    enrollment_state: "active",
    per_page: "100",
  });
  return list.filter((c) => c.workflow_state === "available" || c.workflow_state === "completed");
}

/**
 * Fetch upcoming calendar events (tutorials, labs, exams, etc.) within a date range.
 * Use type=event for non-assignment events; assignments are fetched via syncAssignments.
 */
export async function syncCalendar(options?: {
  startDate?: string; // yyyy-mm-dd
  endDate?: string;   // yyyy-mm-dd
}): Promise<CanvasCalendarEvent[]> {
  const start = options?.startDate ?? new Date().toISOString().slice(0, 10);
  const end = options?.endDate ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const list = await canvasFetchAll<CanvasCalendarEvent>("/calendar_events", {
    type: "event",
    start_date: start,
    end_date: end,
    per_page: "100",
  });
  return list.filter((e) => e.workflow_state !== "deleted");
}

/**
 * Fetch assignments (homework tasks and descriptions) for all enrolled courses.
 */
export async function syncAssignments(): Promise<CanvasAssignment[]> {
  const courses = await syncCourses();
  const all: CanvasAssignment[] = [];
  for (const course of courses) {
    const assignments = await canvasFetchAll<CanvasAssignment>(
      `/courses/${course.id}/assignments`,
      { per_page: "100" }
    );
    all.push(...assignments);
  }
  return all;
}
