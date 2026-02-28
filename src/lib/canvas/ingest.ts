/**
 * Canvas data ingestion for AI Study Companion.
 * Fetches courses, modules, module items, pages, and files; extracts text for embedding.
 * Does NOT write to the database — returns materials for storeCourseMaterials().
 */

export type IngestedMaterial = {
  canvas_item_id: string;
  content_type: "lecture" | "file" | "page" | "assignment";
  content_text: string;
  metadata: {
    title?: string;
    url?: string;
    created_at?: string;
    updated_at?: string;
    author?: string;
    [key: string]: unknown;
  };
};

// --- Canvas API response types (minimal) ---

export interface CanvasModule {
  id: number;
  name: string;
  position?: number;
  items?: CanvasModuleItem[];
}

export interface CanvasModuleItem {
  id: number;
  module_id: number;
  title: string;
  type: string;
  content_id?: number;
  page_url?: string;
  html_url?: string;
  url?: string;
}

export interface CanvasPage {
  page_id?: number;
  url?: string;
  title?: string;
  body?: string;
  created_at?: string;
  updated_at?: string;
  last_edited_by?: { display_name?: string } | null;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  html_url?: string;
}

export interface CanvasFile {
  id: number;
  display_name?: string;
  filename?: string;
  created_at?: string;
  updated_at?: string;
  url?: string;
}

export class CanvasAPIClient {
  private apiBase: string;
  private token: string;

  constructor(baseUrl: string, accessToken: string) {
    const base = baseUrl.replace(/\/$/, "");
    this.apiBase = base + "/api/v1";
    this.token = accessToken;
  }

  private async fetch<T>(path: string, params?: Record<string, string>): Promise<T> {
    let url = this.apiBase + path;
    if (params && Object.keys(params).length > 0) {
      const u = new URL(url);
      Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
      url = u.toString();
    }
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Canvas API ${res.status}: ${text || res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  private async fetchAll<T>(path: string, params?: Record<string, string>): Promise<T[]> {
    const out: T[] = [];
    let url: string = this.apiBase + path;
    if (params) {
      const u = new URL(url);
      Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
      url = u.toString();
    }
    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.token}` },
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

  async getCourses(): Promise<CanvasCourse[]> {
    const list = await this.fetchAll<CanvasCourse>("/courses", {
      enrollment_state: "active",
      per_page: "100",
    });
    return list.filter(
      (c) => c.workflow_state === "available" || c.workflow_state === "completed"
    );
  }

  async getCourseModules(courseId: string): Promise<CanvasModule[]> {
    return this.fetchAll<CanvasModule>(`/courses/${courseId}/modules`, {
      per_page: "100",
      include: "items",
    });
  }

  async getModuleItems(courseId: string, moduleId: number): Promise<CanvasModuleItem[]> {
    return this.fetchAll<CanvasModuleItem>(
      `/courses/${courseId}/modules/${moduleId}/items`,
      { per_page: "100" }
    );
  }

  async getPage(courseId: string, pageIdOrUrl: string): Promise<CanvasPage> {
    return this.fetch<CanvasPage>(
      `/courses/${encodeURIComponent(courseId)}/pages/${encodeURIComponent(pageIdOrUrl)}`
    );
  }

  async getFile(courseId: string, fileId: number): Promise<CanvasFile> {
    return this.fetch<CanvasFile>(`/courses/${courseId}/files/${fileId}`);
  }

  async getAssignment(courseId: string, assignmentId: number): Promise<CanvasAssignment> {
    return this.fetch<CanvasAssignment>(
      `/courses/${courseId}/assignments/${assignmentId}`
    );
  }
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code?: string;
  workflow_state?: string;
}

/**
 * Strip HTML tags and normalize whitespace to plain text.
 */
export function extractTextFromHTML(html: string): string {
  if (!html || typeof html !== "string") return "";
  const stripped = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return stripped;
}

/**
 * Map Canvas module item type to our content_type.
 */
function toContentType(type: string): "lecture" | "file" | "page" | "assignment" {
  switch (type) {
    case "Page":
      return "page";
    case "File":
      return "file";
    case "Assignment":
    case "Quiz":
      return "assignment";
    default:
      return "lecture";
  }
}

/**
 * Ingest course materials from Canvas for a single course.
 * Fetches modules and items, then pulls page body and assignment descriptions.
 * Returns an array of material objects ready for embedding/storage (no DB write).
 */
export async function ingestCourseMaterials(
  courseId: string,
  accessToken: string,
  baseUrl: string
): Promise<IngestedMaterial[]> {
  const client = new CanvasAPIClient(baseUrl, accessToken);
  const materials: IngestedMaterial[] = [];
  const seenIds = new Set<string>();

  function addMaterial(
    canvas_item_id: string,
    content_type: IngestedMaterial["content_type"],
    content_text: string,
    metadata: IngestedMaterial["metadata"]
  ) {
    const key = canvas_item_id;
    if (seenIds.has(key) || !content_text.trim()) return;
    seenIds.add(key);
    materials.push({
      canvas_item_id,
      content_type,
      content_text: content_text.trim(),
      metadata,
    });
  }

  const modules = await client.getCourseModules(courseId);

  for (const mod of modules) {
    const items =
      mod.items && mod.items.length > 0
        ? mod.items
        : await client.getModuleItems(courseId, mod.id);

    for (const item of items) {
      const baseMeta = {
        title: item.title,
        url: item.html_url ?? item.url,
        module_name: mod.name,
      };

      try {
        if (item.type === "Page" && (item.page_url ?? item.content_id)) {
          const pageId = item.page_url ?? String(item.content_id!);
          const page = await client.getPage(courseId, pageId);
          const text = extractTextFromHTML(page.body ?? "");
          if (text) {
            addMaterial(
              `page-${courseId}-${page.page_id ?? pageId}`,
              "page",
              text,
              {
                ...baseMeta,
                title: page.title ?? item.title,
                url: item.html_url,
                created_at: page.created_at,
                updated_at: page.updated_at,
                author: page.last_edited_by?.display_name,
              }
            );
          }
        } else if (item.type === "Assignment" && item.content_id) {
          const assignment = await client.getAssignment(courseId, item.content_id);
          const text = extractTextFromHTML(assignment.description ?? "");
          if (text) {
            addMaterial(
              `assignment-${courseId}-${assignment.id}`,
              "assignment",
              text,
              {
                ...baseMeta,
                title: assignment.name,
                url: assignment.html_url,
                created_at: assignment.created_at,
                updated_at: assignment.updated_at,
              }
            );
          }
        } else if (item.type === "File" && item.content_id) {
          const file = await client.getFile(courseId, item.content_id);
          const title = file.display_name ?? file.filename ?? item.title;
          addMaterial(
            `file-${courseId}-${file.id}`,
            "file",
            title,
            {
              ...baseMeta,
              title,
              url: file.url,
              created_at: file.created_at,
              updated_at: file.updated_at,
            }
          );
        }
        // SubHeader, ExternalUrl, ExternalTool, Discussion, Quiz (without description fetch) skipped or treated as lecture placeholder
      } catch (err) {
        console.warn(
          `Skipping module item ${item.id} (${item.type}):`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  return materials;
}
