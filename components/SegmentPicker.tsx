"use client";

import { useRef, useState, useCallback } from "react";
import { formatTimecode, formatDuration, parseTimecode } from "@/lib/time";

export interface Segment {
  start: number;
  end: number;
}

interface Props {
  duration: number;
  currentTime: number;
  segments: Segment[];
  onChange: (segments: Segment[]) => void;
  onSeek: (time: number) => void;
}

export default function SegmentPicker({
  duration,
  currentTime,
  segments,
  onChange,
  onSeek,
}: Props) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [pendingIn, setPendingIn] = useState<number | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ start: "", end: "" });

  const posToTime = useCallback(
    (e: React.MouseEvent) => {
      const rect = timelineRef.current!.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration]
  );

  const handleTimelineClick = (e: React.MouseEvent) => {
    const t = posToTime(e);
    onSeek(t);
  };

  const handleTimelineDoubleClick = (e: React.MouseEvent) => {
    const t = posToTime(e);
    if (pendingIn === null) {
      setPendingIn(t);
    } else {
      commitSegment(pendingIn, t);
    }
  };

  const commitSegment = (a: number, b: number) => {
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    if (end - start < 1) return;
    const overlaps = segments.some((s) => start < s.end && end > s.start);
    if (overlaps) return;
    onChange([...segments, { start, end }].sort((a, b) => a.start - b.start));
    setPendingIn(null);
  };

  const handleMarkIn = () => setPendingIn(currentTime);

  const handleMarkOut = () => {
    if (pendingIn === null) return;
    commitSegment(pendingIn, currentTime);
  };

  const removeSegment = (i: number) => {
    onChange(segments.filter((_, idx) => idx !== i));
  };

  const startEdit = (i: number) => {
    setEditIdx(i);
    setEditValues({
      start: formatTimecode(segments[i].start),
      end: formatTimecode(segments[i].end),
    });
  };

  const commitEdit = (i: number) => {
    const start = parseTimecode(editValues.start);
    const end = parseTimecode(editValues.end);
    if (isNaN(start) || isNaN(end) || end <= start) return;
    const updated = segments.map((s, idx) => (idx === i ? { start, end } : s));
    onChange(updated.sort((a, b) => a.start - b.start));
    setEditIdx(null);
  };

  const pct = (t: number) => `${((t / duration) * 100).toFixed(3)}%`;
  const totalSelected = segments.reduce((s, seg) => s + (seg.end - seg.start), 0);
  const costEstimate = ((totalSelected / 60) * 0.0043).toFixed(4);

  return (
    <div className="space-y-3">
      {/* Timeline */}
      <div
        ref={timelineRef}
        className="relative h-8 bg-zinc-800 rounded cursor-crosshair select-none"
        onClick={handleTimelineClick}
        onDoubleClick={handleTimelineDoubleClick}
      >
        {/* Segments */}
        {segments.map((seg, i) => (
          <div
            key={i}
            className="absolute top-0 h-full bg-blue-500/60 rounded"
            style={{ left: pct(seg.start), width: pct(seg.end - seg.start) }}
          />
        ))}

        {/* Pending IN marker */}
        {pendingIn !== null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-yellow-400"
            style={{ left: pct(pendingIn) }}
          />
        )}

        {/* Current time */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white/80 pointer-events-none"
          style={{ left: pct(currentTime) }}
        />

        {/* Time labels */}
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">
          {formatTimecode(0)}
        </span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">
          {formatTimecode(duration)}
        </span>
      </div>

      <p className="text-[11px] text-zinc-500">
        Двойной клик на таймлайне — отметить IN, затем OUT. Или кнопки ниже.
      </p>

      {/* IN / OUT buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleMarkIn}
          className="px-3 py-1.5 text-sm bg-yellow-500 text-black rounded hover:bg-yellow-400 font-medium"
        >
          Mark IN @ {formatTimecode(currentTime)}
        </button>
        <button
          onClick={handleMarkOut}
          disabled={pendingIn === null}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-40 font-medium"
        >
          Mark OUT @ {formatTimecode(currentTime)}
        </button>
        {pendingIn !== null && (
          <button
            onClick={() => setPendingIn(null)}
            className="px-3 py-1.5 text-sm bg-zinc-700 text-white rounded hover:bg-zinc-600"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Segment list */}
      {segments.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-zinc-400 font-medium">Segments ({segments.length}):</p>
          {segments.map((seg, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-zinc-800/60 rounded px-3 py-2 text-sm"
            >
              {editIdx === i ? (
                <>
                  <input
                    className="w-24 bg-zinc-700 rounded px-2 py-0.5 text-xs font-mono"
                    value={editValues.start}
                    onChange={(e) =>
                      setEditValues((v) => ({ ...v, start: e.target.value }))
                    }
                  />
                  <span className="text-zinc-400">→</span>
                  <input
                    className="w-24 bg-zinc-700 rounded px-2 py-0.5 text-xs font-mono"
                    value={editValues.end}
                    onChange={(e) =>
                      setEditValues((v) => ({ ...v, end: e.target.value }))
                    }
                  />
                  <button
                    onClick={() => commitEdit(i)}
                    className="text-green-400 hover:text-green-300 text-xs"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditIdx(null)}
                    className="text-zinc-400 hover:text-zinc-300 text-xs"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="font-mono text-xs text-zinc-200 flex-1">
                    {formatTimecode(seg.start)} → {formatTimecode(seg.end)}
                    <span className="text-zinc-500 ml-2">({formatDuration(seg.end - seg.start)})</span>
                  </span>
                  <button
                    onClick={() => onSeek(seg.start)}
                    className="text-zinc-400 hover:text-white text-xs"
                    title="Jump to segment"
                  >
                    ▶
                  </button>
                  <button
                    onClick={() => startEdit(i)}
                    className="text-zinc-400 hover:text-white text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeSegment(i)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Cost estimate */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-zinc-400">
          Выбрано: <span className="text-white">{formatDuration(totalSelected)}</span>
        </span>
        <span className="text-zinc-400">
          DeepGram ~<span className="text-green-400">${costEstimate}</span>
        </span>
      </div>
    </div>
  );
}
