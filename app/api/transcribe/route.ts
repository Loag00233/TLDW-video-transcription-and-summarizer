import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import fs from "fs";
import { getDb } from "@/lib/db";
import { extractSegments, remapTimestamps, getVideoDuration, type Segment } from "@/lib/ffmpeg";
import { transcribeAudio } from "@/lib/deepgram";
import type { VideoRecord } from "@/types";

export async function POST(req: NextRequest) {
  const { videoId, segments: rawSegments } = await req.json() as {
    videoId: string;
    segments?: Segment[];
  };

  if (!videoId) {
    return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
  }

  const db = getDb();
  const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId) as VideoRecord | undefined;
  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

  // Сегменты не выбраны — обрабатываем весь файл целиком.
  let segments = rawSegments ?? [];
  if (segments.length === 0) {
    const duration = video.duration_sec ?? (await getVideoDuration(video.path));
    if (!duration || duration <= 0) {
      return NextResponse.json({ error: "Не удалось определить длительность видео" }, { status: 400 });
    }
    segments = [{ start: 0, end: duration }];
  }

  const transcriptionId = nanoid(10);
  const totalAudioSec = segments.reduce((sum, s) => sum + (s.end - s.start), 0);
  const costEstimate = (totalAudioSec / 60) * 0.0043;

  db.prepare(
    `INSERT INTO transcriptions (id, video_id, segments_json, audio_duration_sec, cost_estimate_usd, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'processing', ?)`
  ).run(
    transcriptionId,
    videoId,
    JSON.stringify(segments),
    totalAudioSec,
    costEstimate,
    Date.now()
  );

  let audioPath: string | null = null;

  try {
    const { audioPath: ap, offsets } = await extractSegments(video.path, segments);
    audioPath = ap;

    const result = await transcribeAudio(ap, video.language);
    const remapped = remapTimestamps(result.words, offsets);

    db.prepare(
      "UPDATE transcriptions SET transcript_json = ?, status = 'done' WHERE id = ?"
    ).run(JSON.stringify({ ...result, words: remapped }), transcriptionId);

    if (fs.existsSync(ap)) fs.unlinkSync(ap);

    return NextResponse.json({ transcriptionId, words: remapped, language: result.language });
  } catch (err) {
    if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    db.prepare("UPDATE transcriptions SET status = 'error' WHERE id = ?").run(transcriptionId);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
