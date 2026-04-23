import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { getVideoDuration } from "@/lib/ffmpeg";

const ALLOWED_EXTENSIONS = new Set([".mp4", ".mov", ".mkv", ".webm", ".m4a", ".mp3"]);

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const id = nanoid(10);
  const videoDir = path.join(process.cwd(), "storage", "videos");
  fs.mkdirSync(videoDir, { recursive: true });

  const filePath = path.join(videoDir, `${id}${ext}`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  let duration: number | null = null;
  try {
    duration = await getVideoDuration(filePath);
  } catch {}

  const db = getDb();
  db.prepare(
    `INSERT INTO videos (id, filename, path, duration_sec, language, created_at)
     VALUES (?, ?, ?, ?, 'multi', ?)`
  ).run(id, file.name, filePath, duration, Date.now());

  return NextResponse.json({ id });
}
