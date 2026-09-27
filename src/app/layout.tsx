import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Debate Arena — Voice of Minds",
  description:
    "Cinematic voice-driven AI debates: LOGOS vs PATHOS across 4 rounds, judged by THE REFEREE. 3D avatars, ultra-realistic neural voices, 16 languages — no subtitles, pure performance.",
  keywords: ["AI debate", "voice AI", "3D avatars", "LLM arena", "text to speech"],
};

export const viewport: Viewport = {
  themeColor: "#03050e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
