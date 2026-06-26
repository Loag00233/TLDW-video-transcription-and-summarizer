import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const videos = db
    .prepare(
      `SELECT v.*,
        lt.status as last_status,
        lt.created_at as last_started_at,
        lt.audio_duration_sec as last_audio_sec,
        (SELECT COUNT(*) FROM structured_outputs so
          JOIN transcriptions t ON so.transcription_id = t.id
          WHERE t.video_id = v.id) as structured_count
       FROM videos v
       LEFT JOIN transcriptions lt ON lt.id = (
         SELECT t.id FROM transcriptions t WHERE t.video_id = v.id ORDER BY t.created_at DESC LIMIT 1
       )
       ORDER BY v.created_at DESC`
    )
    .all();
  return NextResponse.json(videos);
}
