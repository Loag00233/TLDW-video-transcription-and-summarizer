export interface VideoRecord {
  id: string;
  filename: string;
  path: string;
  duration_sec: number | null;
  language: string;
  created_at: number;
}

export interface Segment {
  start: number;
  end: number;
}

export interface TranscriptionRecord {
  id: string;
  video_id: string;
  segments_json: string;
  transcript_json: string | null;
  audio_duration_sec: number | null;
  cost_estimate_usd: number | null;
  status: "pending" | "processing" | "done" | "error";
  created_at: number;
}

export interface StructuredOutputRecord {
  id: string;
  transcription_id: string;
  summary: string | null;
  thesis_json: string | null;
  notes_json: string | null;
  actions_json: string | null;
  model: string | null;
  created_at: number;
}
