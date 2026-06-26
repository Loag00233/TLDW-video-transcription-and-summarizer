import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { getVideoDuration } from "@/lib/ffmpeg";

const ALLOWED_EXTENSIONS = new Set([".mp4", ".mov", ".mkv", ".webm", ".m4a", ".mp3"]);

// Папка с локальными медиа. Файл НЕ копируется — в БД хранится ссылка на оригинал.
const MEDIA_DIR = process.env.LOCAL_MEDIA_DIR?.trim() || "/Users/macbook/Movies";

/**
 * Ищет файл по имени в MEDIA_DIR (включая подпапки). Возвращает абсолютные пути совпадений.
 * Обходим вручную, чтобы пропускать защищённые папки (напр. ~/Movies/TV даёт EPERM,
 * на чём встроенный recursive readdir падает целиком).
 */
function findInMediaDir(name: string): string[] {
  const direct = path.join(MEDIA_DIR, name);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return [direct];

  const matches: string[] = [];
  const queue = [MEDIA_DIR];
  while (queue.length) {
    const dir = queue.shift()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue; // нет доступа к папке — пропускаем
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) queue.push(full);
      else if (e.isFile() && e.name === name) matches.push(full);
    }
  }
  return matches;
}

export async function POST(req: NextRequest) {
  const { name } = (await req.json()) as { name?: string };

  if (!name) return NextResponse.json({ error: "Не указано имя файла" }, { status: 400 });

  const ext = path.extname(name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: "Неподдерживаемый тип файла" }, { status: 400 });
  }

  const matches = findInMediaDir(path.basename(name));
  if (matches.length === 0) {
    return NextResponse.json(
      { error: `Файл «${name}» не найден в ${MEDIA_DIR}. Локальные файлы берутся только из этой папки.` },
      { status: 404 }
    );
  }
  if (matches.length > 1) {
    return NextResponse.json(
      { error: `В ${MEDIA_DIR} несколько файлов с именем «${name}». Сделайте имя уникальным.` },
      { status: 409 }
    );
  }

  const filePath = matches[0];

  let duration: number | null = null;
  try {
    duration = await getVideoDuration(filePath);
  } catch {}

  const id = nanoid(10);
  const db = getDb();
  db.prepare(
    `INSERT INTO videos (id, filename, path, duration_sec, language, created_at)
     VALUES (?, ?, ?, ?, 'multi', ?)`
  ).run(id, name, filePath, duration, Date.now());

  return NextResponse.json({ id });
}
