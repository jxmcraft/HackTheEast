"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, Play, Trash2 } from "lucide-react";
import { getSavedLectures, removeSavedLecture, type SavedLecture } from "@/lib/savedLectures";

export default function SavedLecturesPage() {
  const [lectures, setLectures] = useState<SavedLecture[]>([]);

  useEffect(() => {
    setLectures(getSavedLectures());
  }, []);

  const handleOpen = (l: SavedLecture) => {
    const params = new URLSearchParams({
      open: l.sectionId,
      topic: l.topic,
      source: l.sourceType,
    });
    if (l.pdfId) params.set("pdfId", l.pdfId);
    window.location.href = `/studybuddy?${params.toString()}`;
  };

  const handleRemove = (e: React.MouseEvent, l: SavedLecture) => {
    e.preventDefault();
    e.stopPropagation();
    removeSavedLecture(l);
    setLectures(getSavedLectures());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6 text-gray-900 [color-scheme:light]">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/studybuddy"
          className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-800 font-medium mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to StudyBuddy
        </Link>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Bookmark className="w-7 h-7 text-purple-600" />
            Saved lectures
          </h1>
          <p className="text-gray-600 text-sm mb-6">
            Open any lecture to continue watching.
          </p>

          {lectures.length === 0 ? (
            <p className="text-gray-500 py-8 text-center">
              No saved lectures yet. Start a lesson and click &quot;Save lecture&quot; to add it here.
            </p>
          ) : (
            <ul className="space-y-3">
              {lectures.map((l) => (
                <li key={`${l.sectionId}-${l.savedAt}`}>
                  <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50/50 transition-colors">
                    <button
                      type="button"
                      onClick={() => handleOpen(l)}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                        <Play className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{l.sectionTitle}</p>
                        <p className="text-sm text-gray-500">{l.topic}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRemove(e, l)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remove from saved"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
