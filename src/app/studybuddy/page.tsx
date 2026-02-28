/**
 * Main StudyBuddy Page
 * Orchestrates the full user flow:
 * 1. Avatar Studio (if new user)
 * 2. Content Selection (lesson topic, past lessons, PDFs, uploads)
 * 3. Voiced lesson + Chat + Practice
 */

"use client";

import React, { useState, useEffect, useLayoutEffect, useCallback } from "react";
import Link from "next/link";
import AvatarStudio from "@/components/studybuddy/AvatarStudio";
import VideoTeacher from "@/components/studybuddy/VideoTeacher";
import { getUserData, initializeUser, updateLastSection, getFirstStruggle, clearUserData, saveUserData, setLessonTopicFromDashboard, getRecentLessonTopics } from "@/lib/studybuddyStorage";
import type { StudyBuddyUser } from "@/lib/studybuddyStorage";
import { Play, BookOpen, UserCog, LogOut, Link2, CloudDownload, Loader2, Bookmark, FolderUp, FileText } from "lucide-react";
import UploadedMaterials, { getLocalUploads, setLocalUploads, type UploadedDoc } from "@/components/studybuddy/UploadedMaterials";

type PageState = "setup" | "content-selection" | "lesson";

export default function StudyBuddyPage() {
  const [pageState, setPageState] = useState<PageState>("setup");
  const [_currentSectionId, setCurrentSectionId] = useState("__lesson_topic__");
  const [_currentSourceType, setCurrentSourceType] = useState<"lesson_topic">("lesson_topic");
  const [lessonTopicOnlyMode, setLessonTopicOnlyMode] = useState<string | null>(null);
  const [lessonCourseId, setLessonCourseId] = useState<string | null>(null);
  const [canvasMaterialsContent, setCanvasMaterialsContent] = useState<string>("");
  const [canvasMaterialsSources, setCanvasMaterialsSources] = useState<{ title: string; url?: string; content_type?: string }[]>([]);
  const [canvasMaterialsLoading, setCanvasMaterialsLoading] = useState(false);
  const [canvasMaterialsFetched, setCanvasMaterialsFetched] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<{ linked: boolean; email?: string; data?: StudyBuddyUser | null } | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [serverUploads, setServerUploads] = useState<UploadedDoc[]>([]);
  const [localUploads, setLocalUploadsState] = useState<UploadedDoc[]>([]);
  const [fromLessonTopic, setFromLessonTopic] = useState<string | null>(null);

  const userData = getUserData();

  const activeLessonTopic = fromLessonTopic ?? userData?.lessonTopicFromDashboard ?? lessonTopicOnlyMode ?? null;

  // Get current content based on source type (lesson topic only; Canvas materials loaded when from lesson)
  const getCurrentSection = () => {
    const topic = lessonTopicOnlyMode || activeLessonTopic || "Your lesson";
    const content = canvasMaterialsContent
      ? `${topic}\n\nCourse materials from Canvas:\n\n${canvasMaterialsContent}`
      : "Chat with your tutor about your lesson topic. Ask questions, get explanations, or test your understanding.";
    return { id: "__lesson_topic__", title: topic, content };
  };

  const getCurrentTopic = () => lessonTopicOnlyMode || activeLessonTopic || "Your lesson";

  const currentSection = getCurrentSection();
  const currentTopic = getCurrentTopic();

  // Full topic content for script flow; when from lesson with courseId, include Canvas materials
  const topicLabel = lessonTopicOnlyMode || activeLessonTopic || "Your lesson";
  const fullTopicContent = canvasMaterialsContent
    ? `${topicLabel}\n\nCourse materials from Canvas:\n\n${canvasMaterialsContent}\n\nFocus on the student's lesson topic in chat.`
    : `${topicLabel}\n\nFocus on the student's lesson topic in chat.`;

  // Fetch Canvas course materials when opened from a lesson with courseId + topic
  useEffect(() => {
    const topic = fromLessonTopic ?? lessonTopicOnlyMode ?? userData?.lessonTopicFromDashboard ?? "";
    if (!lessonCourseId || !topic.trim()) {
      setCanvasMaterialsFetched(false);
      return;
    }
    let cancelled = false;
    setCanvasMaterialsLoading(true);
    setCanvasMaterialsFetched(false);
    fetch(
      `/api/studybuddy/course-materials?courseId=${encodeURIComponent(lessonCourseId)}&topic=${encodeURIComponent(topic)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          if (typeof data?.content === "string") setCanvasMaterialsContent(data.content);
          if (Array.isArray(data?.sources)) setCanvasMaterialsSources(data.sources);
          else setCanvasMaterialsSources([]);
          setCanvasMaterialsFetched(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCanvasMaterialsSources([]);
          setCanvasMaterialsFetched(true);
        }
      })
      .finally(() => {
        if (!cancelled) setCanvasMaterialsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonCourseId, fromLessonTopic, lessonTopicOnlyMode, userData?.lessonTopicFromDashboard]);

  // Initialize on mount before paint so user doesn't see "Loading..." (useLayoutEffect runs before browser paint)
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      clearUserData();
      window.history.replaceState({}, "", "/studybuddy");
    }
    const fromLesson = params.get("fromLesson");
    const lessonTopicParam = params.get("topic");
    const lessonTopicDecoded = lessonTopicParam
      ? (() => {
          try {
            return decodeURIComponent(lessonTopicParam).trim();
          } catch {
            return lessonTopicParam.trim();
          }
        })()
      : "";
    if (fromLesson === "1" && lessonTopicDecoded) {
      setLessonTopicFromDashboard(lessonTopicDecoded);
      setFromLessonTopic(lessonTopicDecoded);
      setLessonTopicOnlyMode(lessonTopicDecoded);
      setCurrentSectionId("__lesson_topic__");
      const courseIdParam = params.get("courseId")?.trim();
      if (courseIdParam) setLessonCourseId(courseIdParam);
      window.history.replaceState({}, "", "/studybuddy");
      // #region agent log
      const afterSave = getUserData();
      fetch("http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "studybuddy/page.tsx:landedFromLesson", message: "Landed with fromLesson and topic", data: { fromLesson, lessonTopicDecoded, savedInUser: afterSave?.lessonTopicFromDashboard ?? null, hadUser: !!afterSave }, timestamp: Date.now(), hypothesisId: "A" }) }).catch(() => {});
      // #endregion
    }
    const openSection = params.get("open");
    const openTopic = params.get("topic");
    const openSource = params.get("source") as "lesson_topic" | null;

    const user = getUserData();
    if (!user) {
      setPageState("setup");
      setIsLoading(false);
      return;
    }
    if (fromLesson === "1" && lessonTopicDecoded) {
      setPageState("lesson");
    } else {
      setPageState("content-selection");
    }
    const lastSection = user.lastSection;
    const isLegacyNNSection = ["intro", "network_architecture", "activation_functions", "training"].includes(lastSection);
    setCurrentSectionId(isLegacyNNSection ? "__lesson_topic__" : lastSection);

    if (openSection && openTopic && (openSource === "lesson_topic" || !openSource)) {
      setCurrentSectionId(openSection === "intro" || openSection === "network_architecture" || openSection === "activation_functions" || openSection === "training" ? "__lesson_topic__" : openSection);
      setCurrentSourceType("lesson_topic");
      setLessonTopicOnlyMode(openTopic || null);
      setPageState("lesson");
    }
    setIsLoading(false);
  }, []);

  // Load local uploads on mount (content-selection)
  useEffect(() => {
    if (pageState === "content-selection") setLocalUploadsState(getLocalUploads());
  }, [pageState]);

  // Fetch server uploads when on content-selection
  const fetchUploads = useCallback(() => {
    fetch("/api/studybuddy/uploads")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.uploads)) setServerUploads(data.uploads);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pageState === "content-selection") fetchUploads();
  }, [pageState, fetchUploads]);

  const allUploads = [...serverUploads, ...localUploads];

  const handleUploadsChange = useCallback((uploads: UploadedDoc[]) => {
    setLocalUploadsState(uploads);
    setLocalUploads(uploads);
  }, []);

  // Fetch account sync status when on content-selection
  useEffect(() => {
    if (pageState !== "content-selection") return;
    let cancelled = false;
    fetch("/api/studybuddy/sync")
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) {
          setSyncStatus({
            linked: !!body.linked,
            email: body.email,
            data: body.data ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setSyncStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pageState]);

  const handleLinkToAccount = async () => {
    const user = getUserData();
    if (!user) return;
    setSyncLoading(true);
    try {
      const res = await fetch("/api/studybuddy/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });
      const data = await res.json();
      if (res.ok && data.linked) {
        setSyncStatus((s) => ({ ...(s ?? {}), linked: true, email: data.email ?? s?.email, data: s?.data }));
      } else if (res.status === 401) {
        window.location.href = "/login?next=" + encodeURIComponent("/studybuddy");
        return;
      }
    } finally {
      setSyncLoading(false);
    }
  };

  const handleLoadFromAccount = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch("/api/studybuddy/sync");
      const data = await res.json();
      if (res.ok && data.data && data.linked) {
        saveUserData(data.data as StudyBuddyUser);
        setSyncStatus((s) => ({ ...s!, data: data.data }));
        window.location.reload();
      }
    } finally {
      setSyncLoading(false);
    }
  };

  const handleAvatarStudioComplete = (config: {
    userProfile: { name: string; sex: string; birthday: string; email: string; profilePicture: string };
    avatarProfile: { avatarName: string; avatarConfig: Record<string, string>; teachingStylePrompt: string; tutorVoice: string };
  }) => {
    initializeUser(config.userProfile, config.avatarProfile);
    setPageState("content-selection");
  };

  const _handleSelectSection = (sectionId: string) => {
    setCurrentSectionId(sectionId);
    setCurrentSourceType("lesson_topic");
    updateLastSection(currentTopic, sectionId);
    setPageState("lesson");
  };

  const handleStartLessonTopic = (topic: string, courseId?: string) => {
    setCurrentSectionId("__lesson_topic__");
    setCurrentSourceType("lesson_topic");
    setLessonTopicOnlyMode(topic);
    if (courseId) setLessonCourseId(courseId);
    setPageState("lesson");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
        <div className="text-lg font-semibold text-[var(--muted-foreground)]">Loading...</div>
      </div>
    );
  }

  // Page 1: Avatar Studio Setup
  if (pageState === "setup") {
    return <AvatarStudio onComplete={handleAvatarStudioComplete} />;
  }

  const handleStartNewAccount = () => {
    clearUserData();
    setPageState("setup");
  };

  // Page 2: Content Selection
  if (pageState === "content-selection") {
    return (
      <div className="min-h-screen bg-[var(--background)] p-6 text-[var(--foreground)]">
        <div className="max-w-6xl mx-auto">
          {/* Greeting */}
          {userData && (
            <div className="bg-[var(--card)] rounded-lg shadow-lg p-6 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border border-[var(--border)]">
              <div>
                <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
                  {(() => {
                    const struggleId = getFirstStruggle();
                    const struggleDisplay = struggleId
                      ? struggleId === "__lesson_topic__"
                        ? (userData.lessonTopicFromDashboard || "your lesson topic")
                        : struggleId
                      : null;
                    return struggleDisplay
                      ? `Welcome back, ${userData.userProfile.name}! Last time you struggled with ${struggleDisplay}. Ready to master it?`
                      : `Welcome back, ${userData.userProfile.name}! 👋`;
                  })()}
                </h1>
                <p className="text-[var(--muted-foreground)]">
                  Choose a lesson topic or upload materials
                </p>
              </div>
              <div className="flex flex-wrap gap-2 self-start">
                <Link
                  href="/studybuddy/saved"
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/30 text-[var(--color-primary)] font-medium rounded-lg transition-colors"
                >
                  <Bookmark className="w-5 h-5" />
                  Saved lectures
                </Link>
                <button
                  onClick={() => setPageState("setup")}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/30 text-[var(--color-primary)] font-medium rounded-lg transition-colors"
                >
                  <UserCog className="w-5 h-5" />
                  Edit Profile
                </button>
                <button
                  onClick={handleStartNewAccount}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--muted)] hover:bg-[var(--color-surface)] text-[var(--foreground)] font-medium rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Start new account
                </button>
              </div>
            </div>
          )}

          {/* Your lesson: primary option when user came from a dashboard lesson */}
          {activeLessonTopic && (
            <div className="bg-[var(--color-primary)]/15 border-2 border-[var(--color-primary)]/40 rounded-xl shadow-lg p-6 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-6 h-6 text-[var(--color-primary)]" />
                <h2 className="text-xl font-bold text-[var(--foreground)]">Your lesson</h2>
              </div>
              <p className="text-[var(--muted-foreground)] mb-4">
                Practice with the same topic: <strong className="text-[var(--foreground)]">{activeLessonTopic}</strong>
              </p>
              <button
                type="button"
                onClick={() => handleStartLessonTopic(activeLessonTopic)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-primary-foreground)] font-semibold rounded-lg transition-colors"
              >
                <Play className="w-5 h-5" />
                Start chat about {activeLessonTopic}
              </button>
            </div>
          )}

          {/* Your past lessons: when student opened StudyBuddy directly (no current lesson topic) */}
          {!activeLessonTopic && getRecentLessonTopics().length > 0 && (
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Bookmark className="w-5 h-5 text-[var(--color-primary)]" />
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Your past lessons</h2>
              </div>
              <p className="text-sm text-[var(--muted-foreground)] mb-3">
                Topics you practiced before. Choose one to continue.
              </p>
              <div className="flex flex-wrap gap-2">
                {getRecentLessonTopics().map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => handleStartLessonTopic(topic)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
                  >
                    <Play className="w-4 h-4 text-[var(--color-primary)]" />
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Account sync: link avatar & chatbot to signed-in account */}
          <div className="bg-[var(--card)] rounded-lg shadow p-4 mb-6 flex flex-wrap items-center justify-between gap-3 border border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-[var(--color-primary)]" />
              <span className="font-medium text-[var(--foreground)]">Account sync</span>
              {syncStatus?.linked && syncStatus.email && (
                <span className="text-sm text-[var(--muted-foreground)]">Linked as {syncStatus.email}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {syncStatus?.linked !== undefined && (
                <>
                  <button
                    onClick={handleLinkToAccount}
                    disabled={syncLoading}
                    className="flex items-center gap-2 px-3 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-primary-foreground)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {syncLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    {syncStatus.linked ? "Update account with current profile" : "Link to account"}
                  </button>
                  {syncStatus.data && (
                    <button
                      onClick={handleLoadFromAccount}
                      disabled={syncLoading}
                      className="flex items-center gap-2 px-3 py-2 bg-[var(--muted)] hover:bg-[var(--color-surface)] text-[var(--foreground)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {syncLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                      Load from account
                    </button>
                  )}
                </>
              )}
            </div>
            <p className="text-xs text-[var(--muted-foreground)] w-full">
              Sign in at Settings or Sync Dashboard, then link to save your avatar and chatbot to your account.
            </p>
          </div>

          {/* My materials: upload PDF, Word, PPTX */}
          <div className="bg-[var(--card)] rounded-lg shadow p-4 mb-6 border border-[var(--border)]">
            <div className="flex items-center gap-2 mb-3">
              <FolderUp className="w-5 h-5 text-[var(--color-primary)]" />
              <h2 className="text-lg font-semibold text-[var(--foreground)]">My materials</h2>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mb-3">
              Upload PDF, Word, or PowerPoint. The AI will use them in chat and highlight key points per page.
            </p>
            <UploadedMaterials
              uploads={allUploads}
              onRefresh={fetchUploads}
              onUploadsChange={handleUploadsChange}
            />

            {/* Files from your Canvas course used to generate your StudyBuddy lesson — always visible */}
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                <h3 className="text-sm font-semibold text-[var(--foreground)]">Files used for your StudyBuddy lesson</h3>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mb-2">
                Course materials from your Canvas course that we use to generate your lesson (differs per course).
              </p>
              {!lessonCourseId && !canvasMaterialsFetched && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Open a lesson from your dashboard and click &quot;Practice in StudyBuddy&quot; to load and list the files here.
                </p>
              )}
              {canvasMaterialsLoading && !canvasMaterialsFetched && (
                <p className="text-xs text-[var(--muted-foreground)]">Loading…</p>
              )}
              {!canvasMaterialsLoading && canvasMaterialsFetched && canvasMaterialsSources.length === 0 && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  No course materials found for your topic. Sync and ingest your course from the dashboard, then open a lesson and use Practice in StudyBuddy.
                </p>
              )}
              {canvasMaterialsSources.length > 0 && (
                <ul className="space-y-1.5 text-xs">
                  {canvasMaterialsSources.map((src, i) => (
                    <li key={`${src.title}-${i}`} className="flex items-start gap-2">
                      <FileText className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0 mt-0.5" />
                      {src.url ? (
                        <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline truncate">
                          {src.title}
                        </a>
                      ) : (
                        <span className="text-[var(--foreground)] truncate">{src.title}</span>
                      )}
                      {src.content_type && (
                        <span className="shrink-0 text-[var(--muted-foreground)]">({src.content_type})</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Attribution */}
          <div className="mt-8 text-center text-sm text-[var(--muted-foreground)]">
            <p>Powered by MiniMax abab6.5 • Voice by MiniMax Speech</p>
          </div>
        </div>
      </div>
    );
  }

  // Page 3: Lesson with Video Teacher
  if (pageState === "lesson" && currentSection) {
    const lessonTopicPassed = activeLessonTopic ?? undefined;
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "studybuddy/page.tsx:VideoTeacherProps", message: "Passing topic to VideoTeacher", data: { currentTopic, lessonTopicPassed, fromLessonTopic: fromLessonTopic ?? null, userLessonTopic: userData?.lessonTopicFromDashboard ?? null }, timestamp: Date.now(), hypothesisId: "B" }) }).catch(() => {});
    // #endregion
    return (
      <VideoTeacher
        sectionTitle={currentSection.title}
        sectionContent={currentSection.content}
        sectionId={currentSection.id}
        topic={currentTopic}
        fullTopicContent={fullTopicContent}
        uploadedMaterials={allUploads}
        sourceType="lesson_topic"
        lessonTopicFromDashboard={lessonTopicPassed}
        courseMaterialsSources={canvasMaterialsSources}
        courseMaterialsLoading={canvasMaterialsLoading}
        showCourseMaterialsSection={true}
        courseMaterialsFetched={canvasMaterialsFetched}
        hasLessonCourseId={!!lessonCourseId}
        onComplete={() => setPageState("content-selection")}
        onBack={() => setPageState("content-selection")}
      />
    );
  }

  return null;
}
