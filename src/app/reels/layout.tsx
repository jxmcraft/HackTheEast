import { redirect } from "next/navigation";
import { getUser } from "@/utils/supabase/server";

export default async function ReelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login?next=/reels");
  return <>{children}</>;
}
