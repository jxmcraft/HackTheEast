/**
 * Main StudyBuddy Page
 * Orchestrates the full user flow:
 * 1. Avatar Studio (if new user)
 * 2. Content Selection (Neural Networks sections)
 * 3. Voiced lesson + Chat + Practice
 */

"use client";

import React, { useState, useEffect } from "react";
import AvatarStudio from "@/components/studybuddy/AvatarStudio";
import VideoTeacher from "@/components/studybuddy/VideoTeacher";
import { NEURAL_NETWORKS_TOPIC, getAllSections, getSectionById } from "@/lib/neuralNetworksContent";
import { getAllPDFLectures, getPDFLectureById } from "@/lib/pdfContent";
import { getUserData, initializeUser, updateLastSection, getFirstStruggle, clearUserData, saveUserData } from "@/lib/studybuddyStorage";
import type { StudyBuddyUser } from "@/lib/studybuddyStorage";
import { Play, FileText, Book, UserCog, LogOut, Link2, CloudDownload, Loader2 } from "lucide-react";

type PageState = "setup" | "content-selection" | "lesson";

export default function StudyBuddyPage() {
  const [pageState, setPageState] = useState<PageState>("setup");
  const [currentSectionId, setCurrentSectionId] = useState("intro");
  const [currentSourceType, setCurrentSourceType] = useState<"neural_networks" | "pdf">("neural_networks");
  const [currentPDFId, setCurrentPDFId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<{ linked: boolean; email?: string; data?: StudyBuddyUser | null } | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

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

  // Initialize on mount (also handle ?new=1 to start fresh)
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("new=1")) {
      clearUserData();
      window.history.replaceState({}, "", "/studybuddy");
    }
    const user = getUserData();
    if (user) {
      setPageState("content-selection");
      setCurrentSectionId(user.lastSection);
    } else {
      setPageState("setup");
    }
    setIsLoading(false);
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg font-semibold text-gray-600">Loading...</div>
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6 text-gray-900 [color-scheme:light]">
        <div className="max-w-6xl mx-auto">
          {/* Greeting */}
          {userData && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
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
                <p className="text-gray-600">
                  Choose from pre-loaded lectures or PDFs
                </p>
              </div>
              <div className="flex flex-wrap gap-2 self-start">
                <button
                  onClick={() => setPageState("setup")}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium rounded-lg transition-colors"
                >
                  <UserCog className="w-5 h-5" />
                  Edit Profile
                </button>
                <button
                  onClick={handleStartNewAccount}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Start new account
                </button>
              </div>
            </div>
          )}

          {/* Account sync: link avatar & chatbot to signed-in account */}
          <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-gray-900">Account sync</span>
              {syncStatus?.linked && syncStatus.email && (
                <span className="text-sm text-gray-600">Linked as {syncStatus.email}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {syncStatus?.linked !== undefined && (
                <>
                  <button
                    onClick={handleLinkToAccount}
                    disabled={syncLoading}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {syncLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    {syncStatus.linked ? "Update account with current profile" : "Link to account"}
                  </button>
                  {syncStatus.data && (
                    <button
                      onClick={handleLoadFromAccount}
                      disabled={syncLoading}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {syncLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                      Load from account
                    </button>
                  )}
                </>
              )}
            </div>
            <p className="text-xs text-gray-600 w-full">
              Sign in at Settings or Sync Dashboard, then link to save your avatar and chatbot to your account.
            </p>
          </div>

          {/* Neural Networks Topic */}
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <Book className="w-6 h-6 text-purple-600" />
                <h2 className="text-2xl font-bold text-gray-900">
                  {NEURAL_NETWORKS_TOPIC.title}
                </h2>
              </div>
              <p className="text-gray-600 mb-2">{NEURAL_NETWORKS_TOPIC.description}</p>
              <p className="text-sm text-purple-600 font-medium">
                Interactive video lessons with live chat
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleSelectSection(section.id, "neural_networks")}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition-all duration-200 p-6 text-left group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600">
                      {section.order}. {section.title}
                    </h3>
                    <Play className="w-5 h-5 text-purple-400 group-hover:text-purple-600 transition-colors" />
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {section.content.substring(0, 100)}...
                  </p>
                  <p className="text-xs text-purple-600 mt-3 font-medium">🎥 Video Lesson</p>
                </button>
              ))}
            </div>
          </div>

          {/* PDF Lectures */}
          <div>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-lg p-6 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-6 h-6" />
                <h2 className="text-2xl font-bold">
                  PDF Lectures
                </h2>
              </div>
              <p className="text-blue-100">
                Learn from textbooks, lecture slides, and academic papers
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pdfLectures.map((pdfLecture) => (
                <div key={pdfLecture.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {pdfLecture.title}
                      </h3>
                      <p className="text-xs text-gray-600">{pdfLecture.source}</p>
                    </div>
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="space-y-2">
                    {pdfLecture.sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => handleSelectSection(section.id, "pdf", pdfLecture.id)}
                        className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">
                            {section.title}
                          </span>
                          <Play className="w-4 h-4 text-blue-400 group-hover:text-blue-600" />
                        </div>
                        {section.pageNumbers && (
                          <span className="text-xs text-gray-600">{section.pageNumbers}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Attribution */}
          <div className="mt-8 text-center text-sm text-gray-600">
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
        onComplete={() => setPageState("content-selection")}
        onBack={() => setPageState("content-selection")}
      />
    );
  }

  return null;
}
