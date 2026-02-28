/**
 * Canvas data ingestion for AI Study Companion.
 * Fetches courses, then all modules (Canvas “tabs”) and every module item. For each item we fetch
 * page body, assignment descriptions, and file content (PDF/PPTX); extract text for embedding.
 * Follows links in Canvas pages/assignments and recursively scans linked websites for content.
 * Does NOT write to the database — returns materials for storeCourseMaterials().
 */

import { createHash } from "crypto";
import { extractLinksFromHTML, crawlLinkedPages } from "./link-scraper";
import { fetchAndExtractDocument } from "./document-extractor";

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
    source?: "canvas" | "linked";
    source_canvas_item_id?: string;
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

  /** GET /api/v1/courses/:course_id/front_page - returns the course front page or 404 if none set. */
  async getFrontPage(courseId: string): Promise<CanvasPage | null> {
    try {
      return await this.fetch<CanvasPage>(
        `/courses/${encodeURIComponent(courseId)}/front_page`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404") || msg.includes("No front page")) return null;
      throw err;
    }
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
 * (Kept for potential use when classifying linked content.)
 */
/** Stable id for linked-page materials so re-sync can dedupe. */
function linkedPageCanvasId(courseId: string, url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 16);
  return `linked-${courseId}-${hash}`;
}

/**
 * Ingest course materials from Canvas for a single course.
 * Iterates over all Canvas modules (tabs) and all module items, then fetches page body,
 * assignment descriptions, and file content (PDF/PPTX) for embedding.
 * Returns an array of material objects ready for embedding/storage (no DB write).
 * Optional onItemRead(message, itemIndex, itemTotal) is called for each item read (front page, page, file, assignment) so the UI can show progress.
 * Optional onMaterialIngested(material) is called after each material is added; if provided and async, ingest waits for it so you can store each material immediately.
 */
export async function ingestCourseMaterials(
  courseId: string,
  accessToken: string,
  baseUrl: string,
  options?: {
    onItemRead?: (message: string, itemIndex: number, itemTotal: number) => void;
    onMaterialIngested?: (material: IngestedMaterial) => void | Promise<void>;
  }
): Promise<IngestedMaterial[]> {
  const client = new CanvasAPIClient(baseUrl, accessToken);
  const materials: IngestedMaterial[] = [];
  const seenIds = new Set<string>();

  async function addMaterial(
    canvas_item_id: string,
    content_type: IngestedMaterial["content_type"],
    content_text: string,
    metadata: IngestedMaterial["metadata"]
  ): Promise<void> {
    const key = canvas_item_id;
    if (seenIds.has(key) || !content_text.trim()) return;
    seenIds.add(key);
    const material: IngestedMaterial = {
      canvas_item_id,
      content_type,
      content_text: content_text.trim(),
      metadata,
    };
    materials.push(material);
    await options?.onMaterialIngested?.(material);
  }

  const modules = await client.getCourseModules(courseId);

  // Count total items we will report progress for: front page (if any) + each Page/Assignment/File in every module.
  let itemTotal = 0;
  try {
    const frontPage = await client.getFrontPage(courseId);
    if (frontPage?.body != null) itemTotal += 1;
  } catch {
    // ignore
  }
  for (const mod of modules) {
    const items =
      mod.items && mod.items.length > 0
        ? mod.items
        : await client.getModuleItems(courseId, mod.id);
    itemTotal += items.filter((i) => ["Page", "Assignment", "File"].includes(i.type)).length;
  }

  let itemIndex = 0;
  const report = (message: string) => {
    options?.onItemRead?.(message, itemIndex, itemTotal);
    itemIndex += 1;
  };

  // Ingest course front page first (and all its links recursively)
  try {
    const frontPage = await client.getFrontPage(courseId);
    if (frontPage?.body != null) {
      report("Reading front page");
      const text = extractTextFromHTML(frontPage.body);
      if (text) {
        await addMaterial(
          `front-page-${courseId}-${frontPage.page_id ?? "front"}`,
          "page",
          text,
          {
            title: frontPage.title ?? "Course front page",
            url: baseUrl.replace(/\/$/, "") + "/courses/" + courseId + "/pages/" + (frontPage.url ?? ""),
            created_at: frontPage.created_at,
            updated_at: frontPage.updated_at,
            author: frontPage.last_edited_by?.display_name,
            source: "canvas",
            module_name: "Front page",
          }
        );
      }
      const frontLinks = extractLinksFromHTML(frontPage.body, baseUrl);
      if (frontLinks.length > 0) {
        try {
          const linkedPages = await crawlLinkedPages(frontLinks, { maxPages: 25, maxDepth: 2 });
          for (const lp of linkedPages) {
            await addMaterial(
              linkedPageCanvasId(courseId, lp.url),
              "page",
              lp.text,
              {
                title: lp.title,
                url: lp.url,
                source: "linked",
                source_canvas_item_id: `front-page-${courseId}-${frontPage.page_id ?? "front"}`,
                module_name: "Front page",
              }
            );
          }
        } catch (linkErr) {
          console.warn("Link crawl failed for front page:", linkErr instanceof Error ? linkErr.message : linkErr);
        }
      }
    }
  } catch (err) {
    console.warn("Front page fetch skipped:", err instanceof Error ? err.message : err);
  }

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
          report(`Reading page: ${page.title ?? item.title}`);
          const text = extractTextFromHTML(page.body ?? "");
          if (text) {
            await addMaterial(
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
                source: "canvas",
              }
            );
          }
          // Recursively scan links in this Canvas page and add linked web content as materials
          const pageLinks = extractLinksFromHTML(page.body ?? "", baseUrl);
          if (pageLinks.length > 0) {
            try {
              const linkedPages = await crawlLinkedPages(pageLinks, {
                maxPages: 25,
                maxDepth: 2,
              });
              for (const lp of linkedPages) {
                await addMaterial(
                  linkedPageCanvasId(courseId, lp.url),
                  "page",
                  lp.text,
                  {
                    title: lp.title,
                    url: lp.url,
                    source: "linked",
                    source_canvas_item_id: `page-${courseId}-${page.page_id ?? pageId}`,
                    module_name: baseMeta.module_name,
                  }
                );
              }
            } catch (linkErr) {
              console.warn(
                `Link crawl failed for page ${pageId}:`,
                linkErr instanceof Error ? linkErr.message : linkErr
              );
            }
          }
        } else if (item.type === "Assignment" && item.content_id) {
          const assignment = await client.getAssignment(courseId, item.content_id);
          report(`Reading assignment: ${assignment.name}`);
          const text = extractTextFromHTML(assignment.description ?? "");
          if (text) {
            await addMaterial(
              `assignment-${courseId}-${assignment.id}`,
              "assignment",
              text,
              {
                ...baseMeta,
                title: assignment.name,
                url: assignment.html_url,
                created_at: assignment.created_at,
                updated_at: assignment.updated_at,
                source: "canvas",
              }
            );
          }
          // Recursively scan links in assignment description and add linked web content
          const descLinks = extractLinksFromHTML(assignment.description ?? "", baseUrl);
          if (descLinks.length > 0) {
            try {
              const linkedPages = await crawlLinkedPages(descLinks, {
                maxPages: 25,
                maxDepth: 2,
              });
              for (const lp of linkedPages) {
                await addMaterial(
                  linkedPageCanvasId(courseId, lp.url),
                  "page",
                  lp.text,
                  {
                    title: lp.title,
                    url: lp.url,
                    source: "linked",
                    source_canvas_item_id: `assignment-${courseId}-${assignment.id}`,
                    module_name: baseMeta.module_name,
                  }
                );
              }
            } catch (linkErr) {
              console.warn(
                `Link crawl failed for assignment ${assignment.id}:`,
                linkErr instanceof Error ? linkErr.message : linkErr
              );
            }
          }
        } else if (item.type === "File" && item.content_id) {
          const file = await client.getFile(courseId, item.content_id);
          const title = file.display_name ?? file.filename ?? item.title;
          report(`Reading file: ${title}`);
          const isPdf = /\.pdf$/i.test(file.filename ?? "") || /\.pdf$/i.test(file.url ?? "");
          const isPptx = /\.pptx$/i.test(file.filename ?? "") || /\.pptx$/i.test(file.url ?? "");
          let contentText = title;
          if ((isPdf || isPptx) && file.url) {
            try {
              const doc = await fetchAndExtractDocument(file.url, {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              if (doc?.text && doc.text.length >= 50) contentText = doc.text;
            } catch (e) {
              console.warn(`Failed to extract PDF/PPTX for file ${file.id}:`, e instanceof Error ? e.message : e);
            }
          }
          // Only embed extracted text, never the file URL or raw file content
          const textToStore =
            typeof contentText === "string" && !/^https?:\/\/[^\s]+\.(pdf|pptx)(\?|$)/i.test(contentText.trim())
              ? contentText
              : title;
          await addMaterial(
            `file-${courseId}-${file.id}`,
            "file",
            textToStore,
            {
              ...baseMeta,
              title,
              url: file.url,
              created_at: file.created_at,
              updated_at: file.updated_at,
              source: "canvas",
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
