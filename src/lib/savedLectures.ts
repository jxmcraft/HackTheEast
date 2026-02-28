/**
 * Saved lectures (localStorage) for StudyBuddy.
 * Each item can be reopened from /studybuddy with the same section.
 */

const STORAGE_KEY = "studybuddy_saved_lectures";

export type SavedLecture = {
  sectionId: string;
  sectionTitle: string;
  topic: string;
  sourceType: "neural_networks" | "pdf";
  pdfId?: string;
  savedAt: string; // ISO date
};

export function getSavedLectures(): SavedLecture[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown[];
    return Array.isArray(arr)
      ? arr.filter(
          (x): x is SavedLecture =>
            x &&
            typeof x === "object" &&
            typeof (x as SavedLecture).sectionId === "string" &&
            typeof (x as SavedLecture).sectionTitle === "string" &&
            typeof (x as SavedLecture).topic === "string" &&
            typeof (x as SavedLecture).savedAt === "string"
        )
      : [];
  } catch {
    return [];
  }
}

export function saveLecture(lecture: Omit<SavedLecture, "savedAt">): void {
  const list = getSavedLectures();
  const exists = list.some(
    (l) =>
      l.sectionId === lecture.sectionId &&
      l.topic === lecture.topic &&
      (l.pdfId ?? "") === (lecture.pdfId ?? "")
  );
  if (exists) return;
  list.unshift({
    ...lecture,
    savedAt: new Date().toISOString(),
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function removeSavedLecture(lecture: SavedLecture): void {
  const list = getSavedLectures().filter(
    (l) =>
      !(
        l.sectionId === lecture.sectionId &&
        l.topic === lecture.topic &&
        (l.pdfId ?? "") === (lecture.pdfId ?? "") &&
        l.savedAt === lecture.savedAt
      )
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function isLectureSaved(lecture: Omit<SavedLecture, "savedAt">): boolean {
  return getSavedLectures().some(
    (l) =>
      l.sectionId === lecture.sectionId &&
      l.topic === lecture.topic &&
      (l.pdfId ?? "") === (lecture.pdfId ?? "")
  );
}
