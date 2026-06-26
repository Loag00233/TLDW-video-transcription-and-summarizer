// Хранилище прогресса скачивания с YouTube. Опрашивается фронтом (polling),
// т.к. скачивание идёт в фоне, а ответ /api/youtube возвращается сразу с jobId.
// Singleton через globalThis — чтобы переживать hot-reload в dev.

export type YtJob = {
  status: "starting" | "downloading" | "processing" | "done" | "error";
  percent: number; // 0..100
  downloaded: number; // байт
  total: number; // байт (0 если неизвестно)
  speed: number; // байт/с
  eta: number; // сек (0 если неизвестно)
  videoId?: string; // id готового видео для редиректа (аудио-флоу /api/youtube)
  savedPath?: string; // абсолютный путь сохранённого файла (download-флоу /api/youtube/download)
  title?: string; // название ролика (для отчёта «Сохранено в …»)
  error?: string;
  updatedAt: number;
};

const store: Map<string, YtJob> =
  (globalThis as unknown as { __ytJobs?: Map<string, YtJob> }).__ytJobs ??
  ((globalThis as unknown as { __ytJobs?: Map<string, YtJob> }).__ytJobs = new Map());

export function createJob(id: string): void {
  store.set(id, {
    status: "starting",
    percent: 0,
    downloaded: 0,
    total: 0,
    speed: 0,
    eta: 0,
    updatedAt: Date.now(),
  });
}

export function updateJob(id: string, patch: Partial<YtJob>): void {
  const cur = store.get(id);
  if (!cur) return;
  store.set(id, { ...cur, ...patch, updatedAt: Date.now() });
}

export function getJob(id: string): YtJob | undefined {
  return store.get(id);
}

// Чистим завершённые задачи спустя минуту, чтобы Map не рос.
export function scheduleCleanup(id: string): void {
  setTimeout(() => store.delete(id), 60_000);
}
