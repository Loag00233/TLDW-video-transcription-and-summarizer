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
    audio_duration_sec: number | null;
    created_at: number;
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
type PromptTemplate = "summary" | "thesis" | "actions" | "custom";

const PROMPT_TEMPLATES: Record<Exclude<PromptTemplate, "custom">, string> = {
  summary: "Прочитай приложенный транскрипт и сделай краткое резюме: основная тема, ключевые моменты, итоги.",
  thesis: "Прочитай приложенный транскрипт и выпиши ключевые тезисы и идеи нумерованным списком.",
  actions: "Прочитай приложенный транскрипт и выпиши все упомянутые задачи, действия и следующие шаги.",
};

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [structureElapsed, setStructureElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("transcript");
  const [language, setLanguage] = useState("multi");
  const [promptModal, setPromptModal] = useState(false);
  const [promptTemplate, setPromptTemplate] = useState<PromptTemplate>("summary");
  const [customPrompt, setCustomPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/videos/${id}`)
      .then((r) => r.json())
      .then((d: VideoData) => {
        setData(d);
        setLanguage(d.video.language);
        if (d.video.duration_sec) setDuration(d.video.duration_sec);
      });
  }, [id]);

  // Статус обработки берём из БД, а не только из локального клика — иначе при
  // возврате на страницу прогресс «теряется», хотя на сервере всё ещё идёт.
  const dbStatus = data?.transcriptions?.[0]?.status;
  const isProcessing = transcribing || dbStatus === "processing";

  useEffect(() => {
    if (!isProcessing) return;
    setNowTick(Date.now());
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isProcessing]);

  // Обработка идёт на сервере (напр. после возврата на страницу) — опрашиваем
  // статус, пока он не сменится на done/error.
  useEffect(() => {
    if (dbStatus !== "processing") return;
    const t = setInterval(() => {
      fetch(`/api/videos/${id}`).then((r) => r.json()).then(setData);
    }, 5000);
    return () => clearInterval(t);
  }, [dbStatus, id]);

  useEffect(() => {
    if (!structuring) { setStructureElapsed(0); return; }
    const t = setInterval(() => setStructureElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [structuring]);

  const latestTranscription = data?.transcriptions[0];
  const processingBase = dbStatus === "processing"
    ? latestTranscription?.created_at ?? null
    : startedAt;
  const transcribeElapsed = processingBase
    ? Math.max(0, Math.floor((nowTick - processingBase) / 1000))
    : 0;
  const transcriptData = latestTranscription?.transcript_json
    ? JSON.parse(latestTranscription.transcript_json) as { words: Word[]; fullText: string }
    : null;
  const words: Word[] = transcriptData?.words ?? [];
  const fullText: string = transcriptData?.fullText ?? "";
  const structured = latestTranscription?.structured;

  const seek = (time: number) => {
    if (videoRef.current) videoRef.current.currentTime = time;
  };

  const handleTranscribe = async () => {
    setError(null);
    setStartedAt(Date.now());
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
      setStartedAt(null);
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

  const baseName = data?.video.filename.replace(/\.[^.]+$/, "") ?? "transcript";

  const downloadPlain = () => {
    triggerDownload(fullText, `${baseName}_transcript.txt`, "text/plain");
  };

  const downloadTimed = () => {
    const INTERVAL = 300;
    const sections: { time: number; words: string[] }[] = [];

    for (const w of words) {
      const sectionTime = Math.floor(w.start / INTERVAL) * INTERVAL;
      const last = sections[sections.length - 1];
      if (!last || last.time !== sectionTime) {
        sections.push({ time: sectionTime, words: [w.word] });
      } else {
        last.words.push(w.word);
      }
    }

    const text = sections
      .map((s) => `[${formatTimecode(s.time)}]\n${s.words.join(" ")}`)
      .join("\n\n");

    triggerDownload(text, `${baseName}_timed.txt`, "text/plain");
  };

  const downloadSpeakers = () => {
    const sections: { time: number; speaker?: number; words: string[] }[] = [];

    for (const w of words) {
      const last = sections[sections.length - 1];
      if (last && last.speaker === w.speaker) {
        last.words.push(w.word);
      } else {
        sections.push({ time: w.start, speaker: w.speaker, words: [w.word] });
      }
    }

    const text = sections
      .map((s) => {
        const label = s.speaker !== undefined ? `Спикер ${s.speaker + 1}` : "Спикер";
        return `[${formatTimecode(s.time)}] ${label}\n${s.words.join(" ")}`;
      })
      .join("\n\n");

    triggerDownload(text, `${baseName}_speakers.txt`, "text/plain");
  };

  const currentPromptText =
    promptTemplate === "custom" ? customPrompt : PROMPT_TEMPLATES[promptTemplate];

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(currentPromptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <h2 className="font-medium text-sm text-zinc-300">
          Выбор сегментов <span className="text-zinc-500 font-normal">(необязательно)</span>
        </h2>
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

        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isProcessing}
            className="text-sm bg-zinc-800 border border-zinc-700 rounded px-3 py-2.5 disabled:opacity-40"
          >
            <option value="multi">Авто (RU/EN)</option>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
          <button
            onClick={handleTranscribe}
            disabled={isProcessing}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isProcessing && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-200 border-t-transparent animate-spin flex-shrink-0" />
            )}
            {isProcessing
              ? `Транскрибирую... ${transcribeElapsed}с`
              : segments.length === 0
                ? "Транскрибировать весь файл"
                : "Транскрибировать выбранное"}
          </button>
        </div>

        {isProcessing && (() => {
          const totalSec = (dbStatus === "processing" && latestTranscription?.audio_duration_sec)
            ? latestTranscription.audio_duration_sec
            : segments.length === 0
              ? duration
              : segments.reduce((sum, s) => sum + (s.end - s.start), 0);
          const estimated = Math.max(8, totalSec * 0.25);
          const progress = Math.min(95, (transcribeElapsed / estimated) * 100);
          return (
            <div className="space-y-1">
              <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 text-right">
                ~{Math.max(0, Math.round(estimated - transcribeElapsed))}с осталось
              </p>
            </div>
          );
        })()}
      </div>

      {/* Results */}
      {(words.length > 0 || structured) && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-4">
          {/* Tab bar + actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("transcript")}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                tab === "transcript" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              Transcript
            </button>
            {structured && (
              <button
                onClick={() => setTab("structured")}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  tab === "structured" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"
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
                {structuring ? `Анализирую... ${structureElapsed}с` : "Structure with Claude"}
              </button>
            )}
          </div>

          {/* Download buttons — shown only on transcript tab */}
          {words.length > 0 && tab === "transcript" && (
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
              <span className="text-xs text-zinc-500 mr-1">Скачать:</span>
              <button
                onClick={downloadPlain}
                className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
              >
                Сплошной текст
              </button>
              <button
                onClick={downloadTimed}
                className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
              >
                Сплошной текст + 5 мин блоки
              </button>
              <button
                onClick={downloadSpeakers}
                className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
              >
                Разбиение по спикерам
              </button>
              <button
                onClick={() => setPromptModal(true)}
                className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
              >
                Промпт для AI
              </button>
            </div>
          )}

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

      {/* Prompt modal */}
      {promptModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setPromptModal(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-lg space-y-4 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-white">Промпт для AI</h3>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["summary", "Краткое резюме"],
                  ["thesis", "Ключевые тезисы"],
                  ["actions", "Действия и задачи"],
                  ["custom", "Свой промпт"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setPromptTemplate(value)}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    promptTemplate === value
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {promptTemplate === "custom" ? (
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Введи инструкцию для AI..."
                className="w-full h-28 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white resize-none placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
              />
            ) : (
              <div className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 leading-relaxed">
                {currentPromptText}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setPromptModal(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Закрыть
              </button>
              <button
                onClick={copyPrompt}
                disabled={promptTemplate === "custom" && !customPrompt.trim()}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition-colors min-w-[110px]"
              >
                {copied ? "Скопировано!" : "Скопировать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
