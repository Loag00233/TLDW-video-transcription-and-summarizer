import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const videos = db
    .prepare(
      `SELECT v.*,
        (SELECT t.status FROM transcriptions t WHERE t.video_id = v.id ORDER BY t.created_at DESC LIMIT 1) as last_status,
        (SELECT COUNT(*) FROM structured_outputs so
          JOIN transcriptions t ON so.transcription_id = t.id
          WHERE t.video_id = v.id) as structured_count
       FROM videos v ORDER BY v.created_at DESC`
    )
    .all();
  return NextResponse.json(videos);
}
