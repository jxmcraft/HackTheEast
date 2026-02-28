"use client";

import React, { useEffect, useState } from "react";
import { getDiagramForSection } from "@/lib/sectionDiagrams";

interface LessonDiagramProps {
  sectionId: string;
  topicId?: string;
}

export default function LessonDiagram({ sectionId, topicId }: LessonDiagramProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [svg, setSvg] = useState<string | null>(null);

  const diagramCode = getDiagramForSection(sectionId, topicId);

  useEffect(() => {
    if (!diagramCode) {
      setLoading(false);
      setSvg(null);
      setError(null);
      return;
    }

    setError(null);
    setLoading(true);
    setSvg(null);

    const id = `mermaid-${sectionId}-${topicId ?? "x"}-${Date.now()}`;
    import("mermaid").then((mermaidModule) => {
      const mermaid = mermaidModule.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "loose",
        flowchart: { useMaxWidth: true, htmlLabels: true },
      });
      return mermaid.render(id, diagramCode);
    }).then(({ svg: resultSvg }) => {
      setSvg(resultSvg);
      setLoading(false);
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Diagram error");
      setLoading(false);
    });
  }, [diagramCode, sectionId, topicId]);

  if (!diagramCode) return null;

  return (
    <div className="absolute bottom-24 left-4 right-4 md:left-auto md:right-4 md:w-72 max-h-[220px] rounded-xl bg-gray-900/95 border border-gray-600 overflow-hidden shadow-xl flex flex-col">
      <div className="px-3 py-1.5 border-b border-gray-600 shrink-0">
        <span className="text-xs font-medium text-white">Diagram</span>
      </div>
      <div className="p-2 flex-1 min-h-0 overflow-auto flex items-center justify-center bg-gray-800/50">
        {loading ? (
          <p className="text-xs text-gray-400">Loading...</p>
        ) : error ? (
          <p className="text-xs text-amber-400">{error}</p>
        ) : svg ? (
          <div
            className="mermaid-container [&_svg]:max-w-full [&_svg]:max-h-[180px] [&_svg]:w-auto [&_svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : null}
      </div>
    </div>
  );
}
