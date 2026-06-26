"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/time";
import Onboarding from "@/components/Onboarding";

interface VideoRow {
  id: string;
  filename: string;
  duration_sec: number | null;
  language: string;
  created_at: number;
  last_status: string | null;
  last_started_at: number | null;
  last_audio_sec: number | null;
  structured_count: number;
}

interface SetupStatus {
  hasDeepGram: boolean;
  settings: Record<string, string>;
}

export default function LibraryPage() {
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const loadSetup = () =>
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: SetupStatus) => {
        setSetup(d);
        return d;
      });

  useEffect(() => {
    loadSetup().then((d: SetupStatus) => {
      const provider = d.settings.llm_provider ?? "groq";
      const llmMissing =
        provider === "groq" ? !d.settings.groq_api_key :
        provider === "deepseek" ? !d.settings.deepseek_api_key :
        provider === "gemini" ? !d.settings.gemini_api_key : false;
      // Auto-open setup if keys missing
      if (!d.hasDeepGram || llmMissing) setShowSetup(true);
    });
    fetch("/api/videos")
      .then((r) => r.json())
      .then((data) => { setVideos(data); setLoading(false); });
  }, []);

  // Пока хоть одно видео в обработке — опрашиваем список и тикаем часы, чтобы
  // прогресс/таймер жили и здесь (например, после ухода со страницы видео).
  const anyProcessing = videos.some((v) => v.last_status === "processing");
  useEffect(() => {
    if (!anyProcessing) return;
    const tick = setInterval(() => setNowTick(Date.now()), 1000);
    const poll = setInterval(() => {
      fetch("/api/videos").then((r) => r.json()).then(setVideos);
    }, 4000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [anyProcessing]);

  if (!setup || loading) {
    return <p className="text-zinc-500">Загрузка...</p>;
  }

  const provider = setup.settings.llm_provider ?? "groq";
  const llmKeyMissing =
    provider === "groq" ? !setup.settings.groq_api_key :
    provider === "deepseek" ? !setup.settings.deepseek_api_key :
    provider === "gemini" ? !setup.settings.gemini_api_key :
    false;

  const needsSetup = !setup.hasDeepGram || llmKeyMissing;

  return (
    <div className="space-y-8">

      {/* Library */}
      <section>
        <h1 className="text-xl font-semibold mb-4">Библиотека</h1>
        {videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-zinc-400">Видео ещё нет</p>
            <a
              href="/upload"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              Загрузить первое видео
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {videos.map((v) => (
              <a
                key={v.id}
                href={`/videos/${v.id}`}
                className="flex items-center gap-4 p-4 bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-800"
              >
                <span className="text-zinc-500 text-lg">&#9654;</span>
                <span className="flex-1 font-medium text-sm truncate">{v.filename}</span>
                <span className="text-zinc-500 text-xs font-mono shrink-0">
                  {v.duration_sec ? formatDuration(v.duration_sec) : "—"}
                </span>
                <span className="text-zinc-500 text-xs w-12 text-center shrink-0">{v.last_status === "done" ? v.language : "—"}</span>
                <StatusBadge
                  status={v.last_status}
                  structured={v.structured_count > 0}
                  startedAt={v.last_started_at}
                  audioSec={v.last_audio_sec}
                  now={nowTick}
                />
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Setup block — always visible */}
      <section className={`rounded-xl border ${needsSetup ? "border-yellow-600/50" : "border-zinc-700"}`}>
        {/* Header — always shown */}
        <button
          onClick={() => setShowSetup((p) => !p)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-zinc-100">Настройка ключей</span>
            <div className="flex items-center gap-2">
              <KeyBadge
                label="DeepGram"
                ok={setup.hasDeepGram}
              />
              <KeyBadge
                label={`ИИ (${provider})`}
                ok={!llmKeyMissing}
              />
            </div>
          </div>
          <span className="text-zinc-500 text-sm">{showSetup ? "▴ свернуть" : "▾ развернуть"}</span>
        </button>

        {/* Body */}
        {showSetup && (
          <div className="border-t border-zinc-800 px-5 py-6">
            <Onboarding
              missingDeepgram={!setup.hasDeepGram}
              missingLlm={llmKeyMissing}
              onComplete={() => {
                loadSetup();
                if (!needsSetup) setShowSetup(false);
              }}
            />
          </div>
        )}
      </section>

    </div>
  );
}

function KeyBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded flex items-center gap-1 ${
      ok ? "bg-green-900/40 text-green-400" : "bg-yellow-900/40 text-yellow-400"
    }`}>
      {ok ? "✓" : "!"} {label}
    </span>
  );
}

function StatusBadge({
  status,
  structured,
  startedAt,
  audioSec,
  now,
}: {
  status: string | null;
  structured: boolean;
  startedAt?: number | null;
  audioSec?: number | null;
  now?: number;
}) {
  if (status === "processing") {
    const elapsed = startedAt && now ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
    const estimated = Math.max(8, (audioSec ?? 0) * 0.25);
    const pct = Math.min(95, Math.round((elapsed / estimated) * 100));
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    return (
      <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded shrink-0 flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
        обрабатывается {mm}:{ss}{audioSec ? ` · ${pct}%` : ""}
      </span>
    );
  }
  if (structured) return <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded shrink-0">анализ готов</span>;
  if (status === "done") return <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded shrink-0">расшифровано</span>;
  if (status === "error") return <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded shrink-0">ошибка</span>;
  return <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded shrink-0">нет сегментов</span>;
}
