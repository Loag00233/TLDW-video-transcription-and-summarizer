import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { getVideoDuration } from "@/lib/ffmpeg";
import {
  isYoutubeUrl,
  getYoutubeTitle,
  downloadYoutubeAudioWithProgress,
} from "@/lib/youtube";
import { createJob, updateJob, scheduleCleanup } from "@/lib/ytJobs";

// Скачивание идёт в фоне; ответ возвращается сразу. maxDuration держим высоким,
// т.к. фоновая работа живёт в рамках процесса обработчика.
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const { url } = (await req.json()) as { url?: string };

  if (!url || !isYoutubeUrl(url)) {
    return NextResponse.json({ error: "Укажите корректную ссылку на YouTube" }, { status: 400 });
  }

  const id = nanoid(10);
  const audioDir = path.join(process.cwd(), "storage", "audio");
  createJob(id);

  // Запускаем скачивание в фоне, не дожидаясь — фронт опрашивает /api/youtube/progress.
  void (async () => {
    let filePath: string | null = null;
    try {
      const title = await getYoutubeTitle(url);
      updateJob(id, { status: "downloading" });

      filePath = await downloadYoutubeAudioWithProgress(
        url,
        audioDir,
        id,
        (p) =>
          updateJob(id, {
            status: "downloading",
            percent: p.percent,
            downloaded: p.downloaded,
            total: p.total,
            speed: p.speed,
            eta: p.eta,
          }),
        () => updateJob(id, { status: "processing", percent: 100 })
      );

      let duration: number | null = null;
      try {
        duration = await getVideoDuration(filePath);
      } catch {}

      const db = getDb();
      db.prepare(
        `INSERT INTO videos (id, filename, path, duration_sec, language, created_at)
         VALUES (?, ?, ?, ?, 'ru', ?)`
      ).run(id, `${title}.m4a`, filePath, duration, Date.now());

      updateJob(id, { status: "done", percent: 100, videoId: id });
      scheduleCleanup(id);
    } catch (err) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      const message = err instanceof Error ? err.message : "Не удалось импортировать видео с YouTube";
      updateJob(id, { status: "error", error: message });
      scheduleCleanup(id);
    }
  })();

  // Сразу отдаём jobId — фронт начинает опрашивать прогресс.
  return NextResponse.json({ jobId: id });
}
