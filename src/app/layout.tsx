import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Header } from "@/components/layout/Header";
import PersistentStudyBuddyAvatar from "@/components/studybuddy/PersistentStudyBuddyAvatar";
import ThemeSidebar from "@/components/theme/ThemeSidebar";

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
          <ThemeProvider>
            <Header />
            {children}
            <PersistentStudyBuddyAvatar />
            <ThemeSidebar />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
