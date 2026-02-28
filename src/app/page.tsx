import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">HTE</h1>
      <p className="text-[var(--muted-foreground)]">
        Canvas LMS sync & study dashboard
      </p>
      <Link
        href="/sync-dashboard"
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
      >
        Open Sync Dashboard
      </Link>
    </main>
  );
}
