import { redirect, notFound } from "next/navigation";
import { createClientOrThrow } from "@/utils/supabase/server";
import { LessonPageClient } from "@/components/lesson/LessonPageClient";
import type { AvatarStyle } from "@/lib/avatar/personality";

type Props = { params: Promise<{ courseId: string; topic: string }>; searchParams: Promise<{ context?: string; lessonId?: string }> };

export default async function LessonPage({ params, searchParams }: Props) {
  const { courseId, topic } = await params;
  const { context: contextParam, lessonId: lessonIdParam } = await searchParams;
  const context = contextParam ? decodeURIComponent(contextParam) : "";
  const lessonIdFromUrl = lessonIdParam ? decodeURIComponent(lessonIdParam) : null;
  const courseIdNum = Number(courseId);
  if (!Number.isInteger(courseIdNum)) notFound();
  const topicDecoded = decodeURIComponent(topic.replace(/-/g, " "));
  if (!topicDecoded.trim()) notFound();

  const supabase = createClientOrThrow();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/lesson/" + courseId + "/" + topic);

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("avatar_style, avatar_name")
    .eq("id", user.id)
    .single();

  const rawStyle = prefs?.avatar_style ?? "";
  const avatarStyle: AvatarStyle = ["strict", "encouraging", "socratic"].includes(rawStyle)
    ? (rawStyle as AvatarStyle)
    : "encouraging";
  const avatarName = (prefs?.avatar_name ?? "").trim() || "Tutor";

  let courseName: string | null = null;
  const credentials = await (await import("@/lib/canvas-credentials")).getCanvasCredentialsFromProfile();
  if (credentials?.baseUrl && credentials?.token) {
    try {
      const courses = await (await import("@/lib/canvas")).syncCourses(credentials);
      const c = courses.find((x) => x.id === courseIdNum);
      courseName = c?.name ?? null;
    } catch {
      // ignore
    }
  }

  return (
    <LessonPageClient
      courseId={courseId}
      topic={topicDecoded}
      context={context}
      courseName={courseName}
      lessonIdFromUrl={lessonIdFromUrl}
      avatarName={avatarName}
      avatarStyle={avatarStyle}
    />
  );
}
