import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const transcriptions = db
    .prepare("SELECT * FROM transcriptions WHERE video_id = ? ORDER BY created_at DESC")
    .all(id);

  const transcriptionsWithOutput = (transcriptions as Record<string, unknown>[]).map((t) => {
    const structured = db
      .prepare(
        "SELECT * FROM structured_outputs WHERE transcription_id = ? ORDER BY created_at DESC LIMIT 1"
      )
      .get(t.id as string);
    return { ...t, structured };
  });

  return NextResponse.json({ video, transcriptions: transcriptionsWithOutput });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  if (body.language) {
    db.prepare("UPDATE videos SET language = ? WHERE id = ?").run(body.language, id);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const video = db.prepare("SELECT path FROM videos WHERE id = ?").get(id) as { path: string } | undefined;

  if (video) {
    const fs = await import("fs");
    if (fs.existsSync(video.path)) fs.unlinkSync(video.path);
    db.prepare("DELETE FROM videos WHERE id = ?").run(id);
  }

  return NextResponse.json({ ok: true });
}
