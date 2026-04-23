import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db";

export async function GET() {
  const videoDir = path.join(process.cwd(), "storage", "videos");
  const audioDir = path.join(process.cwd(), "storage", "audio");

  const countAndSize = (dir: string) => {
    if (!fs.existsSync(dir)) return { count: 0, bytes: 0 };
    const files = fs.readdirSync(dir);
    const bytes = files.reduce((sum, f) => {
      try { return sum + fs.statSync(path.join(dir, f)).size; } catch { return sum; }
    }, 0);
    return { count: files.length, bytes };
  };

  const videos = countAndSize(videoDir);
  const audio = countAndSize(audioDir);

  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;

  const deepgramDbRow = rows.find((r) => r.key === "deepgram_api_key");
  const hasDeepGram = !!process.env.DEEPGRAM_API_KEY || !!deepgramDbRow?.value;

  return NextResponse.json({
    hasDeepGram,
    hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
    storage: {
      videoCount: videos.count,
      videoBytes: videos.bytes,
      audioCount: audio.count,
    },
    settings,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, string>;
  const db = getDb();

  const allowed = new Set([
    "llm_provider",
    "groq_api_key",
    "deepseek_api_key",
    "gemini_api_key",
    "deepgram_api_key",
    "ollama_model",
    "ollama_base_url",
  ]);

  for (const [key, value] of Object.entries(body)) {
    if (!allowed.has(key)) continue;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
  }

  return NextResponse.json({ ok: true });
}
