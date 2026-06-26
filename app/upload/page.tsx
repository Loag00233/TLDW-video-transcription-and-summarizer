"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtBytes, fmtTime } from "@/lib/format";

export default function UploadPage() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Счётчик секунд во время скачивания/загрузки — чтобы было видно, что процесс идёт.
  const busy = downloading || uploading;
  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [busy]);
  const [updatingYtDlp, setUpdatingYtDlp] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  type Progress = {
    status: "starting" | "downloading" | "processing" | "done" | "error";
    percent: number;
    downloaded: number;
    total: number;
    speed: number;
    eta: number;
  };
  const [progress, setProgress] = useState<Progress | null>(null);

  const refreshCookies = useCallback(() => {
    // Войти за пользователя нельзя — открываем YouTube, чтобы он обновил сессию.
    // После этого cookies в Chrome подхватятся автоматически при следующем скачивании.
    window.open("https://www.youtube.com", "_blank");
    setStatus("Откройте YouTube, убедитесь что вы вошли — cookies обновятся автоматически.");
  }, []);

  const updateYtDlp = useCallback(async () => {
    setUpdatingYtDlp(true);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/youtube/maintenance", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Не удалось обновить yt-dlp");
      setStatus(data.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setUpdatingYtDlp(false);
    }
  }, []);

  const importYoutube = useCallback(
    async () => {
      const trimmed = url.trim();
      if (!trimmed) return;
      setDownloading(true);
      setError(null);
      setProgress(null);
      try {
        const res = await fetch("/api/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Download failed");
        const jobId: string = data.jobId;

        // Опрашиваем прогресс раз в секунду, пока не done/error.
        for (;;) {
          await new Promise((r) => setTimeout(r, 1000));
          const pr = await fetch(`/api/youtube/progress?id=${jobId}`);
          if (pr.status === 404) continue; // задача ещё не успела создаться
          const job = (await pr.json()) as Progress & { videoId?: string; error?: string };
          setProgress(job);
          if (job.status === "done" && job.videoId) {
            router.push(`/videos/${job.videoId}`);
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
    },
    [url, router]
  );

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        // Файл не заливаем — отправляем только имя. Сервер находит оригинал
        // в папке Movies и хранит ссылку на него (без копии).
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        router.push(`/videos/${data.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        setUploading(false);
      }
    },
    [router]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
  };

  return (
    <div className="max-w-lg mx-auto py-16">
      <h1 className="text-xl font-semibold mb-6">Upload video</h1>

      <p className="mb-3 text-amber-300/90 text-sm bg-amber-950/20 border border-amber-900/40 rounded-lg px-4 py-2.5">
        ℹ️ Локальные файлы берутся только из папки <span className="font-mono">/Users/macbook/Movies</span> (включая подпапки). Файл не копируется — используется оригинал.
      </p>

      <label
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl h-56 cursor-pointer transition-colors ${
          dragging
            ? "border-blue-400 bg-blue-950/30"
            : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/40"
        } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          className="hidden"
          accept=".mp4,.mov,.mkv,.webm,.m4a,.mp3"
          onChange={handleChange}
        />
        {uploading ? (
          <div className="flex items-center gap-2 text-zinc-300">
            <span className="inline-block w-4 h-4 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
            <span>Загрузка… {elapsed}&nbsp;с</span>
          </div>
        ) : (
          <>
            <span className="text-4xl mb-3">&#128250;</span>
            <p className="text-zinc-300 font-medium">Drag & drop or click to choose</p>
            <p className="text-zinc-500 text-sm mt-1">mp4, mov, mkv, webm, m4a, mp3</p>
          </>
        )}
      </label>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-zinc-500 text-xs uppercase tracking-wide">или вставьте ссылку</span>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") importYoutube(); }}
          placeholder="https://youtube.com/watch?v=..."
          disabled={downloading}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
        <button
          onClick={importYoutube}
          disabled={downloading || !url.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-sm rounded-lg transition-colors whitespace-nowrap flex items-center gap-2"
        >
          {downloading && (
            <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          )}
          {downloading ? "Скачивание..." : "Скачать аудио"}
        </button>
      </div>

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
                  ? "Обработка аудио…"
                  : `Подготовка… ${elapsed} с`}
              </span>
            </div>
          )}
        </div>
      )}
      <p className="text-zinc-500 text-xs mt-2">
        Аудиодорожка YouTube-ролика. Дальше выберете моменты и язык расшифровки.
      </p>

      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={refreshCookies}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors"
        >
          Обновить куки
        </button>
        <button
          onClick={updateYtDlp}
          disabled={updatingYtDlp}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-xs rounded-lg transition-colors"
        >
          {updatingYtDlp ? "Обновление..." : "Обновить yt-dlp"}
        </button>
      </div>
      <p className="text-zinc-600 text-xs mt-2">
        Если YouTube перестал скачиваться — обновите куки (войдите в YouTube) и/или yt-dlp.
      </p>

      {status && (
        <p className="mt-4 text-emerald-400 text-sm bg-emerald-950/30 rounded-lg px-4 py-3">
          {status}
        </p>
      )}

      {error && (
        <p className="mt-4 text-red-400 text-sm bg-red-950/30 rounded-lg px-4 py-3">
          {error}
        </p>
      )}
    </div>
  );
}
