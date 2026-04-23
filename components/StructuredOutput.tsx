"use client";

import { useState } from "react";
import { formatTimecode } from "@/lib/time";
import { parseTimecode } from "@/lib/time";

interface Note {
  timecode: string;
  text: string;
}

interface Props {
  summary: string;
  thesis: string[];
  notes: Note[];
  actions: string[];
  onSeek?: (time: number) => void;
}

type Tab = "summary" | "thesis" | "notes" | "actions";

export default function StructuredOutput({ summary, thesis, notes, actions, onSeek }: Props) {
  const [tab, setTab] = useState<Tab>("summary");
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toMarkdown = () => {
    const lines = [
      "## Summary",
      summary,
      "",
      "## Key Thesis",
      ...thesis.map((t) => `- ${t}`),
      "",
      "## Notes",
      ...notes.map((n) => `- [${n.timecode}] ${n.text}`),
      "",
      "## Action Items",
      ...actions.map((a) => `- [ ] ${a}`),
    ];
    return lines.join("\n");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(toMarkdown());
  };

  const handleExport = () => {
    const blob = new Blob([toMarkdown()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "summary", label: "Summary" },
    { id: "thesis", label: "Thesis", count: thesis.length },
    { id: "notes", label: "Notes", count: notes.length },
    { id: "actions", label: "Actions", count: actions.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                tab === t.id
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="ml-1 text-xs opacity-70">({t.count})</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
          >
            Copy MD
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
          >
            Export .md
          </button>
        </div>
      </div>

      <div className="bg-zinc-900/60 rounded-lg p-4">
        {tab === "summary" && (
          <p className="text-zinc-200 leading-relaxed">{summary}</p>
        )}

        {tab === "thesis" && (
          <ul className="space-y-2">
            {thesis.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm text-zinc-200">
                <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                {t}
              </li>
            ))}
          </ul>
        )}

        {tab === "notes" && (
          <ul className="space-y-3">
            {notes.map((n, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <button
                  onClick={() => onSeek?.(parseTimecode(n.timecode))}
                  className="font-mono text-xs text-blue-400 hover:text-blue-300 shrink-0 pt-0.5"
                >
                  {n.timecode}
                </button>
                <span className="text-zinc-200">{n.text}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === "actions" && (
          <ul className="space-y-2">
            {actions.length === 0 ? (
              <p className="text-zinc-500 text-sm">Нет action items</p>
            ) : (
              actions.map((a, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm cursor-pointer"
                  onClick={() =>
                    setChecked((prev) => {
                      const next = new Set(prev);
                      next.has(i) ? next.delete(i) : next.add(i);
                      return next;
                    })
                  }
                >
                  <span
                    className={`mt-0.5 w-4 h-4 border rounded shrink-0 flex items-center justify-center text-xs ${
                      checked.has(i)
                        ? "bg-green-600 border-green-600 text-white"
                        : "border-zinc-600"
                    }`}
                  >
                    {checked.has(i) ? "✓" : ""}
                  </span>
                  <span className={checked.has(i) ? "line-through text-zinc-500" : "text-zinc-200"}>
                    {a}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
