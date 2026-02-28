/**
 * Main StudyBuddy Page
 * Orchestrates the full user flow:
 * 1. Avatar Studio (if new user)
 * 2. Content Selection (Neural Networks sections)
 * 3. Voiced lesson + Chat + Practice
 */

"use client";

import React, { useState, useEffect, useLayoutEffect, useCallback } from "react";
import Link from "next/link";
import AvatarStudio from "@/components/studybuddy/AvatarStudio";
import VideoTeacher from "@/components/studybuddy/VideoTeacher";
import { NEURAL_NETWORKS_TOPIC, getAllSections, getSectionById } from "@/lib/neuralNetworksContent";
import { getAllPDFLectures, getPDFLectureById } from "@/lib/pdfContent";
import { getUserData, initializeUser, updateLastSection, getFirstStruggle, clearUserData, saveUserData } from "@/lib/studybuddyStorage";
import type { StudyBuddyUser } from "@/lib/studybuddyStorage";
import { Play, FileText, Book, UserCog, LogOut, Link2, CloudDownload, Loader2, Bookmark, FolderUp } from "lucide-react";
import UploadedMaterials, { getLocalUploads, setLocalUploads, type UploadedDoc } from "@/components/studybuddy/UploadedMaterials";

type PageState = "setup" | "content-selection" | "lesson";

export default function StudyBuddyPage() {
  const [pageState, setPageState] = useState<PageState>("setup");
  const [currentSectionId, setCurrentSectionId] = useState("intro");
  const [currentSourceType, setCurrentSourceType] = useState<"neural_networks" | "pdf">("neural_networks");
  const [currentPDFId, setCurrentPDFId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<{ linked: boolean; email?: string; data?: StudyBuddyUser | null } | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [serverUploads, setServerUploads] = useState<UploadedDoc[]>([]);
  const [localUploads, setLocalUploadsState] = useState<UploadedDoc[]>([]);

  const sections = getAllSections();
  const pdfLectures = getAllPDFLectures();
  const userData = getUserData();

  // Get current content based on source type
  const getCurrentSection = () => {
    if (currentSourceType === "pdf" && currentPDFId) {
      const pdfLecture = getPDFLectureById(currentPDFId);
      return pdfLecture?.sections.find((s) => s.id === currentSectionId);
    }
    return getSectionById(currentSectionId);
  };

  const getCurrentTopic = () => {
    if (currentSourceType === "pdf" && currentPDFId) {
      const pdfLecture = getPDFLectureById(currentPDFId);
      return pdfLecture?.title || "PDF Lecture";
    }
    return NEURAL_NETWORKS_TOPIC.title;
  };

  const currentSection = getCurrentSection();
  const currentTopic = getCurrentTopic();

  // Full topic content for script flow (all sections so AI can connect them)
  const fullTopicContent =
    currentSourceType === "pdf" && currentPDFId
      ? (getPDFLectureById(currentPDFId)?.sections ?? [])
          .map((s) => `${s.title}\n\n${s.content}`)
          .join("\n\n---\n\n")
      : sections.map((s) => `${s.title}\n\n${s.content}`).join("\n\n---\n\n");

  // Initialize on mount before paint so user doesn't see "Loading..." (useLayoutEffect runs before browser paint)
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      clearUserData();
      window.history.replaceState({}, "", "/studybuddy");
    }
    const openSection = params.get("open");
    const openTopic = params.get("topic");
    const openSource = params.get("source") as "neural_networks" | "pdf" | null;
    const openPdfId = params.get("pdfId") ?? "";

    const user = getUserData();
    if (!user) {
      setPageState("setup");
      setIsLoading(false);
      return;
    }
    setPageState("content-selection");
    setCurrentSectionId(user.lastSection);

    if (openSection && openTopic) {
      setCurrentSectionId(openSection);
      setCurrentSourceType(openSource === "pdf" ? "pdf" : "neural_networks");
      if (openSource === "pdf" && openPdfId) setCurrentPDFId(openPdfId);
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

  const handleSelectSection = (sectionId: string, sourceType: "neural_networks" | "pdf" = "neural_networks", pdfId?: string) => {
    setCurrentSectionId(sectionId);
    setCurrentSourceType(sourceType);
    if (pdfId) setCurrentPDFId(pdfId);
    updateLastSection(currentTopic, sectionId);
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
                      ? (getSectionById(struggleId)?.title ?? struggleId)
                      : null;
                    return struggleDisplay
                      ? `Welcome back, ${userData.userProfile.name}! Last time you struggled with ${struggleDisplay}. Ready to master it?`
                      : `Welcome back, ${userData.userProfile.name}! 👋`;
                  })()}
                </h1>
                <p className="text-[var(--muted-foreground)]">
                  Choose from pre-loaded lectures or PDFs
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
          </div>

          {/* Neural Networks Topic */}
          <div className="mb-8">
            <div className="bg-[var(--card)] rounded-lg shadow-lg p-6 mb-4 border border-[var(--border)]">
              <div className="flex items-center gap-3 mb-2">
                <Book className="w-6 h-6 text-[var(--color-primary)]" />
                <h2 className="text-2xl font-bold text-[var(--foreground)]">
                  {NEURAL_NETWORKS_TOPIC.title}
                </h2>
              </div>
              <p className="text-[var(--muted-foreground)] mb-2">{NEURAL_NETWORKS_TOPIC.description}</p>
              <p className="text-sm text-[var(--color-primary)] font-medium">
                Interactive video lessons with live chat
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleSelectSection(section.id, "neural_networks")}
                  className="bg-[var(--card)] rounded-lg shadow hover:shadow-lg transition-all duration-200 p-6 text-left group border border-[var(--border)] hover:border-[var(--color-primary)]/50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-[var(--foreground)] group-hover:text-[var(--color-primary)]">
                      {section.order}. {section.title}
                    </h3>
                    <Play className="w-5 h-5 text-[var(--color-primary)]/70 group-hover:text-[var(--color-primary)] transition-colors" />
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)] line-clamp-2">
                    {section.content.substring(0, 100)}...
                  </p>
                  <p className="text-xs text-[var(--color-primary)] mt-3 font-medium">🎥 Video Lesson</p>
                </button>
              ))}
            </div>
          </div>

          {/* PDF Lectures */}
          <div>
            <div className="bg-[var(--color-primary)] text-[var(--color-primary-foreground)] rounded-lg shadow-lg p-6 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-6 h-6" />
                <h2 className="text-2xl font-bold">
                  PDF Lectures
                </h2>
              </div>
              <p className="text-[var(--color-primary-foreground)]/90">
                Learn from textbooks, lecture slides, and academic papers
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pdfLectures.map((pdfLecture) => (
                <div key={pdfLecture.id} className="bg-[var(--card)] rounded-lg shadow p-6 border border-[var(--border)]">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">
                        {pdfLecture.title}
                      </h3>
                      <p className="text-xs text-[var(--muted-foreground)]">{pdfLecture.source}</p>
                    </div>
                    <FileText className="w-5 h-5 text-[var(--color-primary)]" />
                  </div>
                  <div className="space-y-2">
                    {pdfLecture.sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => handleSelectSection(section.id, "pdf", pdfLecture.id)}
                        className="w-full text-left px-3 py-2 rounded hover:bg-[var(--muted)] transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--color-primary)]">
                            {section.title}
                          </span>
                          <Play className="w-4 h-4 text-[var(--color-primary)]/70 group-hover:text-[var(--color-primary)]" />
                        </div>
                        {section.pageNumbers && (
                          <span className="text-xs text-[var(--muted-foreground)]">{section.pageNumbers}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
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
    return (
      <VideoTeacher
        sectionTitle={currentSection.title}
        sectionContent={currentSection.content}
        sectionId={currentSection.id}
        topic={currentTopic}
        fullTopicContent={fullTopicContent}
        uploadedMaterials={allUploads}
        sourceType={currentSourceType}
        pdfId={currentSourceType === "pdf" ? currentPDFId : undefined}
        onComplete={() => setPageState("content-selection")}
        onBack={() => setPageState("content-selection")}
      />
    );
  }

  return null;
}
