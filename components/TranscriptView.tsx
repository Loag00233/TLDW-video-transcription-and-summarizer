"use client";

import { formatTimecode } from "@/lib/time";

interface Word {
  word: string;
  start: number;
  end: number;
  speaker?: number;
}

interface Props {
  words: Word[];
  onSeek: (time: number) => void;
}

const COLORS = [
  "text-blue-400",
  "text-emerald-400",
  "text-purple-400",
  "text-orange-400",
  "text-pink-400",
];

export default function TranscriptView({ words, onSeek }: Props) {
  const grouped: { time: number; speaker?: number; words: string[] }[] = [];

  for (const w of words) {
    const last = grouped[grouped.length - 1];
    const sameSpeaker = last && last.speaker === w.speaker;
    const closeEnough = last && w.start - last.time < 8;

    if (sameSpeaker && closeEnough) {
      last.words.push(w.word);
    } else {
      grouped.push({ time: w.start, speaker: w.speaker, words: [w.word] });
    }
  }

  return (
    <div className="space-y-3 text-sm">
      {grouped.map((g, i) => (
        <div key={i} className="flex gap-3">
          <button
            onClick={() => onSeek(g.time)}
            className="shrink-0 font-mono text-xs text-zinc-500 hover:text-blue-400 transition-colors pt-0.5"
            title={`Jump to ${formatTimecode(g.time)}`}
          >
            {formatTimecode(g.time)}
          </button>
          <div>
            {g.speaker !== undefined && (
              <span
                className={`text-xs font-medium mr-2 ${COLORS[g.speaker % COLORS.length]}`}
              >
                Спикер {g.speaker + 1}
              </span>
            )}
            <span className="text-zinc-200 leading-relaxed">
              {g.words.join(" ")}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
