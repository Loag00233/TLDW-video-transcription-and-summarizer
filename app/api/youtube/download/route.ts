import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import {
  isYoutubeUrl,
  getYoutubeTitle,
  downloadYoutubeVideoWithProgress,
  type VideoQuality,
} from "@/lib/youtube";
import { createJob, updateJob, scheduleCleanup } from "@/lib/ytJobs";
import { MEDIA_DIR, sanitizeFilename, uniqueBaseName } from "@/lib/paths";

// Скачивание идёт в фоне; ответ возвращается сразу. maxDuration держим высоким,
// т.к. фоновая работа живёт в рамках процесса обработчика.
export const maxDuration = 600;

const QUALITIES: ReadonlySet<VideoQuality> = new Set([
  "best",
  "1080p",
  "720p",
  "480p",
  "audio",
]);

export async function POST(req: NextRequest) {
  const { url, quality } = (await req.json()) as {
    url?: string;
    quality?: VideoQuality;
  };

  if (!url || !isYoutubeUrl(url)) {
    return NextResponse.json({ error: "Укажите корректную ссылку на YouTube" }, { status: 400 });
  }
  if (!quality || !QUALITIES.has(quality)) {
    return NextResponse.json({ error: "Неизвестный пресет качества" }, { status: 400 });
  }

  const id = nanoid(10);
  createJob(id);

  // Скачивание в фоне — фронт опрашивает /api/youtube/progress?id=. В videos НЕ пишем:
  // запись создаётся только по кнопке «Расшифровать» через /api/upload.
  void (async () => {
    let savedPath: string | null = null;
    try {
      const title = await getYoutubeTitle(url);
      const ext = quality === "audio" ? "m4a" : "mp4";
      fs.mkdirSync(MEDIA_DIR, { recursive: true });
      const base = uniqueBaseName(MEDIA_DIR, sanitizeFilename(title), ext);
      const outTemplate = path.join(MEDIA_DIR, `${base}.%(ext)s`);
      savedPath = path.join(MEDIA_DIR, `${base}.${ext}`);

      updateJob(id, { status: "downloading", title });

      await downloadYoutubeVideoWithProgress(url, outTemplate, quality, {
        onProgress: (p) =>
          updateJob(id, {
            status: "downloading",
            percent: p.percent,
            downloaded: p.downloaded,
            total: p.total,
            speed: p.speed,
            eta: p.eta,
          }),
        onPostprocess: () => updateJob(id, { status: "processing", percent: 100 }),
      });

      updateJob(id, { status: "done", percent: 100, savedPath, title });
      scheduleCleanup(id);
    } catch (err) {
      if (savedPath && fs.existsSync(savedPath)) {
        try {
          fs.unlinkSync(savedPath);
        } catch {}
      }
      const message = err instanceof Error ? err.message : "Не удалось скачать видео с YouTube";
      updateJob(id, { status: "error", error: message });
      scheduleCleanup(id);
    }
  })();

  return NextResponse.json({ jobId: id });
}
