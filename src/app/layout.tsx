import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Header } from "@/components/layout/Header";
import PersistentStudyBuddyAvatar from "@/components/studybuddy/PersistentStudyBuddyAvatar";

export const metadata: Metadata = {
  title: "HTE – Sync Dashboard",
  description: "Canvas LMS sync & study dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <Header />
          {children}
          <PersistentStudyBuddyAvatar />
        </AuthProvider>
      </body>
    </html>
  );
}
