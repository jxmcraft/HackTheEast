import { redirect } from "next/navigation";
import { getUser } from "@/utils/supabase/server";

export default async function SyncDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login?next=/sync-dashboard");
  return <>{children}</>;
}
