import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { structureWithLLM } from "@/lib/llm";
import type { TranscriptWord } from "@/lib/deepgram";
import type { TranscriptionRecord } from "@/types";

export async function POST(req: NextRequest) {
  const { transcriptionId } = await req.json() as { transcriptionId: string };

  if (!transcriptionId) {
    return NextResponse.json({ error: "Missing transcriptionId" }, { status: 400 });
  }

  const db = getDb();
  const transcription = db
    .prepare("SELECT * FROM transcriptions WHERE id = ?")
    .get(transcriptionId) as TranscriptionRecord | undefined;

  if (!transcription || !transcription.transcript_json) {
    return NextResponse.json({ error: "Transcription not found or not ready" }, { status: 404 });
  }

  const { words } = JSON.parse(transcription.transcript_json) as { words: TranscriptWord[] };

  try {
    const { output: structured, modelLabel } = await structureWithLLM(words);

    const outputId = nanoid(10);
    db.prepare(
      `INSERT INTO structured_outputs (id, transcription_id, summary, thesis_json, notes_json, actions_json, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      outputId,
      transcriptionId,
      structured.summary,
      JSON.stringify(structured.thesis),
      JSON.stringify(structured.notes),
      JSON.stringify(structured.actions),
      modelLabel,
      Date.now()
    );

    return NextResponse.json({ outputId, ...structured });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
