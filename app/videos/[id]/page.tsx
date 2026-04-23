"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import SegmentPicker, { type Segment } from "@/components/SegmentPicker";
import TranscriptView from "@/components/TranscriptView";
import StructuredOutput from "@/components/StructuredOutput";
import { formatDuration, formatTimecode } from "@/lib/time";

interface VideoData {
  video: {
    id: string;
    filename: string;
    duration_sec: number | null;
    language: string;
  };
  transcriptions: Array<{
    id: string;
    status: string;
    transcript_json: string | null;
    cost_estimate_usd: number | null;
    segments_json: string;
    structured: {
      id: string;
      summary: string;
      thesis_json: string;
      notes_json: string;
      actions_json: string;
    } | null;
  }>;
}

interface Word {
  word: string;
  start: number;
  end: number;
  speaker?: number;
}

type Tab = "transcript" | "structured";

export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [data, setData] = useState<VideoData | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [structuring, setStructuring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("transcript");
  const [language, setLanguage] = useState("multi");

  useEffect(() => {
    fetch(`/api/videos/${id}`)
      .then((r) => r.json())
      .then((d: VideoData) => {
        setData(d);
        setLanguage(d.video.language);
        if (d.video.duration_sec) setDuration(d.video.duration_sec);
      });
  }, [id]);

  const latestTranscription = data?.transcriptions[0];
  const words: Word[] = latestTranscription?.transcript_json
    ? (JSON.parse(latestTranscription.transcript_json) as { words: Word[] }).words
    : [];
  const structured = latestTranscription?.structured;

  const seek = (time: number) => {
    if (videoRef.current) videoRef.current.currentTime = time;
  };

  const handleTranscribe = async () => {
    if (segments.length === 0) return;
    setError(null);
    setTranscribing(true);

    if (language !== data!.video.language) {
      await fetch(`/api/videos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
    }

    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: id, segments }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      const updated = await fetch(`/api/videos/${id}`).then((r) => r.json());
      setData(updated);
      setTab("transcript");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  };

  const handleStructure = async () => {
    if (!latestTranscription) return;
    setError(null);
    setStructuring(true);
    try {
      const res = await fetch("/api/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptionId: latestTranscription.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      const updated = await fetch(`/api/videos/${id}`).then((r) => r.json());
      setData(updated);
      setTab("structured");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Structuring failed");
    } finally {
      setStructuring(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Удалить видео?")) return;
    await fetch(`/api/videos/${id}`, { method: "DELETE" });
    router.push("/");
  };

  if (!data) return <p className="text-zinc-500">Loading...</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <a href="/" className="text-sm text-zinc-500 hover:text-white">&larr; Library</a>
          <h1 className="text-lg font-semibold mt-1">{data.video.filename}</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="text-sm bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5"
          >
            <option value="multi">Multi (auto)</option>
            <option value="ru">Russian</option>
            <option value="en">English</option>
          </select>
          <button
            onClick={handleDelete}
            className="text-sm text-red-400 hover:text-red-300"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Video player */}
      <div className="bg-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          src={`/api/stream/${id}`}
          controls
          className="w-full max-h-[420px]"
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
          onLoadedMetadata={() => {
            if (videoRef.current) setDuration(videoRef.current.duration);
          }}
        />
      </div>

      {/* Segment picker */}
      <div className="bg-zinc-900 rounded-xl p-4 space-y-4 border border-zinc-800">
        <h2 className="font-medium text-sm text-zinc-300">Select segments to transcribe</h2>
        <SegmentPicker
          duration={duration}
          currentTime={currentTime}
          segments={segments}
          onChange={setSegments}
          onSeek={seek}
        />

        {error && (
          <p className="text-red-400 text-sm bg-red-950/30 rounded px-3 py-2">{error}</p>
        )}

        <button
          onClick={handleTranscribe}
          disabled={segments.length === 0 || transcribing}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg font-medium transition-colors"
        >
          {transcribing ? "Transcribing..." : "Transcribe selected"}
        </button>
      </div>

      {/* Results */}
      {(words.length > 0 || structured) && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("transcript")}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                tab === "transcript"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Transcript
            </button>
            {structured && (
              <button
                onClick={() => setTab("structured")}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  tab === "structured"
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Structured
              </button>
            )}

            {words.length > 0 && (
              <button
                onClick={handleStructure}
                disabled={structuring}
                className="ml-auto flex items-center gap-2 px-4 py-1.5 text-sm bg-purple-700 hover:bg-purple-600 disabled:bg-purple-900 text-white rounded transition-colors disabled:cursor-not-allowed"
              >
                {structuring && (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-purple-300 border-t-transparent animate-spin" />
                )}
                {structuring ? "Анализирую..." : "Structure with Claude"}
              </button>
            )}
          </div>

          {tab === "transcript" && words.length > 0 && (
            <TranscriptView words={words} onSeek={seek} />
          )}

          {tab === "structured" && structured && (
            <StructuredOutput
              summary={structured.summary}
              thesis={JSON.parse(structured.thesis_json)}
              notes={JSON.parse(structured.notes_json)}
              actions={JSON.parse(structured.actions_json)}
              onSeek={seek}
            />
          )}
        </div>
      )}
    </div>
  );
}
