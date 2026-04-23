import { NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db";

function countAndSize(dir: string) {
  if (!fs.existsSync(dir)) return { count: 0, bytes: 0 };
  const files = fs.readdirSync(dir).filter((f) => !f.startsWith("."));
  const bytes = files.reduce((sum, f) => {
    try { return sum + fs.statSync(path.join(dir, f)).size; } catch { return sum; }
  }, 0);
  return { count: files.length, bytes };
}

function mask(val: string | undefined): string | null {
  if (!val) return null;
  return `${val.slice(0, 6)}...${val.slice(-4)}`;
}

export async function GET() {
  let ffmpeg = "not found";
  try {
    const out = execSync("ffmpeg -version 2>&1", { timeout: 3000 }).toString();
    ffmpeg = out.split("\n")[0].replace("ffmpeg version ", "").split(" ")[0];
  } catch {}

  const db = getDb();
  const dbPath = path.join(process.cwd(), "storage", "app.db");
  const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;

  const videoCount = (db.prepare("SELECT COUNT(*) as n FROM videos").get() as { n: number }).n;
  const transcriptionCount = (db.prepare("SELECT COUNT(*) as n FROM transcriptions").get() as { n: number }).n;
  const structuredCount = (db.prepare("SELECT COUNT(*) as n FROM structured_outputs").get() as { n: number }).n;

  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.key.endsWith("_api_key") && row.value
      ? `${row.value.slice(0, 6)}...${row.value.slice(-4)}`
      : row.value;
  }

  const storagePath = path.join(process.cwd(), "storage");

  return NextResponse.json({
    system: {
      ffmpeg,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime_sec: Math.floor(process.uptime()),
    },
    env: {
      DEEPGRAM_API_KEY: mask(process.env.DEEPGRAM_API_KEY),
      ANTHROPIC_API_KEY: mask(process.env.ANTHROPIC_API_KEY),
    },
    db: {
      size_bytes: dbSize,
      videos: videoCount,
      transcriptions: transcriptionCount,
      structured_outputs: structuredCount,
    },
    storage: {
      videos: countAndSize(path.join(storagePath, "videos")),
      audio: countAndSize(path.join(storagePath, "audio")),
    },
    settings,
  });
}
