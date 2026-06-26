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
    if (last && last.speaker === w.speaker) {
      last.words.push(w.word);
    } else {
      grouped.push({ time: w.start, speaker: w.speaker, words: [w.word] });
    }
  }

  return (
    <div className="space-y-4 text-sm">
      {grouped.map((g, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSeek(g.time)}
              className="font-mono text-xs text-zinc-500 hover:text-blue-400 transition-colors"
              title={`Jump to ${formatTimecode(g.time)}`}
            >
              {formatTimecode(g.time)}
            </button>
            {g.speaker !== undefined && (
              <span className={`text-xs font-semibold ${COLORS[g.speaker % COLORS.length]}`}>
                Спикер {g.speaker + 1}
              </span>
            )}
          </div>
          <p className="text-zinc-200 leading-relaxed pl-1">
            {g.words.join(" ")}
          </p>
        </div>
      ))}
    </div>
  );
}
