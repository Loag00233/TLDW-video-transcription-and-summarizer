"use client";

import { useEffect, useState } from "react";

interface DebugInfo {
  system: { ffmpeg: string; node: string; platform: string; arch: string; uptime_sec: number };
  env: { DEEPGRAM_API_KEY: string | null; ANTHROPIC_API_KEY: string | null };
  db: { size_bytes: number; videos: number; transcriptions: number; structured_outputs: number };
  storage: {
    videos: { count: number; bytes: number };
    audio: { count: number; bytes: number };
  };
  settings: Record<string, string>;
}

interface Props {
  pageState?: Record<string, unknown>;
}

function fmt(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtUptime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function DebugPanel({ pageState }: Props) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<DebugInfo | null>(null);
  const [rawOpen, setRawOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [restarting, setRestarting] = useState(false);

  const handleRestart = async () => {
    setRestarting(true);
    await fetch("/api/restart", { method: "POST" }).catch(() => {});
    // Poll until server is back up, then reload
    const poll = () => {
      setTimeout(() => {
        fetch("/api/debug").then(() => window.location.reload()).catch(poll);
      }, 800);
    };
    poll();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    setInfo(null);
    fetch("/api/debug")
      .then((r) => r.json())
      .then(setInfo);
  }, [open, refreshKey]);

  const rawTranscript = pageState?.rawTranscript as string | undefined;
  const stateWithoutRaw = pageState
    ? Object.fromEntries(Object.entries(pageState).filter(([k]) => k !== "rawTranscript"))
    : undefined;

  return (
    <>
      {/* Toggle button — bottom-right corner */}
      <button
        onClick={() => setOpen((p) => !p)}
        title="Debug panel (F2)"
        className={`fixed bottom-4 right-4 z-50 w-8 h-8 rounded-full text-[11px] font-bold shadow-lg transition-colors ${
          open
            ? "bg-yellow-400 text-zinc-900"
            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
        }`}
      >
        D
      </button>

    <div className="fixed inset-y-0 right-0 w-[380px] bg-zinc-950 border-l border-zinc-700 z-50 overflow-y-auto text-xs font-mono shadow-2xl" style={{ display: open ? undefined : "none" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700 sticky top-0 bg-zinc-950">
        <span className="text-yellow-400 font-bold tracking-widest text-[11px]">DEBUG</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="text-zinc-500 hover:text-white text-[10px] uppercase tracking-wide"
          >
            refresh
          </button>
          <button
            onClick={handleRestart}
            disabled={restarting}
            className="text-orange-400 hover:text-orange-300 disabled:opacity-50 text-[10px] uppercase tracking-wide"
          >
            {restarting ? "restarting..." : "restart"}
          </button>
          <span className="text-zinc-600 text-[10px]">Ctrl+Shift+D</span>
          <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white ml-1">✕</button>
        </div>
      </div>

      <div className="p-3 space-y-5">

        {/* System */}
        <Section title="System">
          {info ? (
            <>
              <Row label="ffmpeg" value={info.system.ffmpeg} />
              <Row label="node" value={info.system.node} />
              <Row label="platform" value={`${info.system.platform} / ${info.system.arch}`} />
              <Row label="uptime" value={fmtUptime(info.system.uptime_sec)} />
            </>
          ) : <Loading />}
        </Section>

        {/* API Keys */}
        <Section title="API Keys (.env.local)">
          {info ? (
            <>
              <Row
                label="DEEPGRAM"
                value={info.env.DEEPGRAM_API_KEY ?? "MISSING"}
                status={info.env.DEEPGRAM_API_KEY ? "ok" : "err"}
              />
              <Row
                label="ANTHROPIC"
                value={info.env.ANTHROPIC_API_KEY ?? "MISSING"}
                status={info.env.ANTHROPIC_API_KEY ? "ok" : "err"}
              />
            </>
          ) : <Loading />}
        </Section>

        {/* LLM Settings */}
        <Section title="LLM Settings (DB)">
          {info ? (
            Object.entries(info.settings).map(([k, v]) => (
              <Row key={k} label={k} value={v || "(empty)"} status={v ? undefined : "warn"} />
            ))
          ) : <Loading />}
        </Section>

        {/* Database */}
        <Section title="Database">
          {info ? (
            <>
              <Row label="file size" value={fmt(info.db.size_bytes)} />
              <Row label="videos" value={String(info.db.videos)} />
              <Row label="transcriptions" value={String(info.db.transcriptions)} />
              <Row label="structured" value={String(info.db.structured_outputs)} />
            </>
          ) : <Loading />}
        </Section>

        {/* Storage */}
        <Section title="Storage">
          {info ? (
            <>
              <Row
                label="videos"
                value={`${info.storage.videos.count} files · ${fmt(info.storage.videos.bytes)}`}
              />
              <Row
                label="audio"
                value={`${info.storage.audio.count} files · ${fmt(info.storage.audio.bytes)}`}
              />
            </>
          ) : <Loading />}
        </Section>

        {/* Page State */}
        {stateWithoutRaw && (
          <Section title="Page State">
            <pre className="text-zinc-300 whitespace-pre-wrap break-all leading-relaxed">
              {JSON.stringify(stateWithoutRaw, null, 2)}
            </pre>
          </Section>
        )}

        {/* Raw Transcript */}
        {rawTranscript && (
          <Section title="Raw Transcript JSON">
            <button
              onClick={() => setRawOpen((p) => !p)}
              className="text-zinc-500 hover:text-white mb-1.5"
            >
              {rawOpen ? "▾ collapse" : "▸ expand"}{" "}
              <span className="text-zinc-600">({(rawTranscript.length / 1024).toFixed(1)} KB)</span>
            </button>
            {rawOpen && (
              <textarea
                readOnly
                value={JSON.stringify(JSON.parse(rawTranscript), null, 2)}
                className="w-full h-64 bg-zinc-900 text-zinc-300 p-2 rounded text-[10px] resize-y border border-zinc-700"
              />
            )}
          </Section>
        )}

      </div>
    </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-yellow-500/80 uppercase tracking-widest text-[9px] mb-2 border-b border-zinc-800 pb-1">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value, status }: { label: string; value: string; status?: "ok" | "err" | "warn" }) {
  const color =
    status === "ok" ? "text-green-400" :
    status === "err" ? "text-red-400" :
    status === "warn" ? "text-yellow-400" :
    "text-zinc-300";
  return (
    <div className="flex gap-2 min-w-0">
      <span className="text-zinc-500 shrink-0 w-28 truncate">{label}</span>
      <span className={`${color} break-all`}>{value}</span>
    </div>
  );
}

function Loading() {
  return <span className="text-zinc-700 animate-pulse">loading...</span>;
}
