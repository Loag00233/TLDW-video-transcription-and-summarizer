"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtBytes, fmtTime } from "@/lib/format";

type Quality = "best" | "1080p" | "720p" | "480p" | "audio";

const PRESETS: { value: Quality; label: string }[] = [
  { value: "best", label: "Лучшее" },
  { value: "1080p", label: "1080p" },
  { value: "720p", label: "720p" },
  { value: "480p", label: "480p" },
  { value: "audio", label: "Только аудио" },
];

type Progress = {
  status: "starting" | "downloading" | "processing" | "done" | "error";
  percent: number;
  downloaded: number;
  total: number;
  speed: number;
  eta: number;
  savedPath?: string;
  title?: string;
  error?: string;
};

function basename(p: string): string {
  return p.split("/").pop() ?? p;
}

export default function DownloadPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState<Quality>("1080p");
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setDownloading(true);
    setError(null);
    setProgress(null);
    setSavedPath(null);
    try {
      const res = await fetch("/api/youtube/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, quality }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Не удалось запустить скачивание");
      const jobId: string = data.jobId;

      // Опрашиваем прогресс раз в секунду, пока не done/error.
      for (;;) {
        await new Promise((r) => setTimeout(r, 1000));
        const pr = await fetch(`/api/youtube/progress?id=${jobId}`);
        if (pr.status === 404) continue; // задача ещё не успела создаться
        const job = (await pr.json()) as Progress;
        setProgress(job);
        if (job.status === "done") {
          setSavedPath(job.savedPath ?? null);
          setDownloading(false);
          return;
        }
        if (job.status === "error") {
          throw new Error(job.error ?? "Не удалось скачать");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setDownloading(false);
      setProgress(null);
    }
  }, [url, quality]);

  // «Расшифровать» — переиспользуем /api/upload: он находит файл по имени в Movies,
  // создаёт запись videos и отдаёт id экрана сегментов.
  const transcribe = useCallback(async () => {
    if (!savedPath) return;
    setTranscribing(true);
    setError(null);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: basename(savedPath) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Не удалось создать расшифровку");
      router.push(`/videos/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setTranscribing(false);
    }
  }, [savedPath, router]);

  return (
    <div className="max-w-lg mx-auto py-16">
      <h1 className="text-xl font-semibold mb-6">Скачать видео с YouTube</h1>

      <p className="mb-4 text-zinc-400 text-sm">
        Скачивает само видео в выбранном качестве в папку{" "}
        <span className="font-mono">~/Movies</span>. Расшифровка — по желанию.
      </p>

      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") download(); }}
        placeholder="https://youtube.com/watch?v=..."
        disabled={downloading}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
      />

      <div className="flex flex-wrap gap-2 mt-3">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setQuality(p.value)}
            disabled={downloading}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors disabled:opacity-50 ${
              quality === p.value
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        onClick={download}
        disabled={downloading || !url.trim()}
        className="mt-4 w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {downloading && (
          <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        )}
        {downloading ? "Скачивание..." : "Скачать"}
      </button>

      {downloading && (
        <div className="mt-3 bg-blue-950/30 rounded-lg px-4 py-3">
          {progress && progress.status === "downloading" ? (
            <>
              <div className="flex justify-between text-blue-200 text-sm mb-2">
                <span>Скачивание… {Math.round(progress.percent)}%</span>
                <span className="text-blue-300/70">
                  {fmtBytes(progress.downloaded)}
                  {progress.total ? ` / ${fmtBytes(progress.total)}` : ""}
                </span>
              </div>
              <div className="h-2 bg-blue-900/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, progress.percent)}%` }}
                />
              </div>
              <div className="flex justify-between text-blue-300/60 text-xs mt-1.5">
                <span>{progress.speed ? `${fmtBytes(progress.speed)}/с` : ""}</span>
                <span>{progress.eta ? `осталось ~${fmtTime(progress.eta)}` : ""}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-blue-300 text-sm">
              <span className="inline-block w-4 h-4 border-2 border-blue-400/40 border-t-blue-300 rounded-full animate-spin" />
              <span>
                {progress?.status === "processing"
                  ? quality === "audio"
                    ? "Обработка аудио…"
                    : "Склейка видео…"
                  : "Подготовка…"}
              </span>
            </div>
          )}
        </div>
      )}

      {savedPath && (
        <div className="mt-4 bg-emerald-950/30 rounded-lg px-4 py-3">
          <p className="text-emerald-400 text-sm">
            Сохранено в <span className="font-mono break-all">{savedPath}</span>
          </p>
          <button
            onClick={transcribe}
            disabled={transcribing}
            className="mt-3 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-sm rounded-lg transition-colors flex items-center gap-2"
          >
            {transcribing && (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {transcribing ? "Открываем…" : "Расшифровать"}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-4 text-red-400 text-sm bg-red-950/30 rounded-lg px-4 py-3">
          {error}
        </p>
      )}
    </div>
  );
}
