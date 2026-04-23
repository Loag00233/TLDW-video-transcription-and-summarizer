import type { Metadata } from "next";
import "./globals.css";
import ClientShell from "@/components/ClientShell";

export const metadata: Metadata = {
  title: "VideoTranscript",
  description: "Local video transcription with DeepGram + Claude",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <nav className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
          <a href="/" className="font-semibold text-lg tracking-tight">
            VideoTranscript
          </a>
          <div className="flex gap-3 text-sm">
            <a href="/settings" className="text-zinc-400 hover:text-white transition-colors">
              Settings
            </a>
            <a
              href="/upload"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
            >
              + Upload
            </a>
          </div>
        </nav>
        <ClientShell>
          <main className="px-6 py-8 max-w-5xl mx-auto">{children}</main>
        </ClientShell>
      </body>
    </html>
  );
}
