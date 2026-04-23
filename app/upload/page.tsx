"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
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
          <p className="text-zinc-400">Uploading...</p>
        ) : (
          <>
            <span className="text-4xl mb-3">&#128250;</span>
            <p className="text-zinc-300 font-medium">Drag & drop or click to choose</p>
            <p className="text-zinc-500 text-sm mt-1">mp4, mov, mkv, webm, m4a, mp3</p>
          </>
        )}
      </label>

      {error && (
        <p className="mt-4 text-red-400 text-sm bg-red-950/30 rounded-lg px-4 py-3">
          {error}
        </p>
      )}
    </div>
  );
}
