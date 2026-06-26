import { execFile, spawn } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

export type DownloadProgress = {
  percent: number; // 0..100
  downloaded: number; // байт
  total: number; // байт (0 если неизвестно)
  speed: number; // байт/с
  eta: number; // сек
};

// Ссылки вида youtube.com/watch?v=, youtu.be/, shorts/, и т.п.
const YOUTUBE_RE = /^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com|youtu\.be)\//i;

export function isYoutubeUrl(url: string): boolean {
  return YOUTUBE_RE.test(url.trim());
}

async function ensureYtDlp(): Promise<void> {
  try {
    await execFileAsync("yt-dlp", ["--version"]);
  } catch {
    throw new Error(
      "yt-dlp не найден. Установите его: brew install yt-dlp"
    );
  }
}

/**
 * Общие аргументы для yt-dlp.
 * Cookies нужны, чтобы обойти проверку YouTube «Sign in to confirm you're not a bot»:
 *   - YT_DLP_COOKIES_FROM_BROWSER=chrome  (берёт cookies из браузера на этой машине)
 *   - YT_DLP_COOKIES_FILE=/path/cookies.txt  (экспортированный файл в формате Netscape)
 * Proxy подставляется только если он реально задан (YT_DLP_PROXY).
 */
function commonArgs(opts: { playerClient?: string } = {}): string[] {
  const args = ["--no-playlist"];

  // Клиент плеера. tv отдаёт прямой https-поток только с аудио (~быстро, без 403);
  // web_safari как fallback отдаёт медленные HLS-фрагменты. Для скачивания видео нужен
  // другой клиент (см. downloadYoutubeVideoWithProgress) — поэтому он параметризуется.
  const playerClient =
    opts.playerClient?.trim() || process.env.YT_DLP_PLAYER_CLIENT?.trim() || "tv";
  args.push("--extractor-args", `youtube:player_client=${playerClient}`);

  const proxy = process.env.YT_DLP_PROXY?.trim();
  if (proxy) {
    args.push("--proxy", proxy);
  }

  const cookiesFromBrowser = process.env.YT_DLP_COOKIES_FROM_BROWSER?.trim();
  const cookiesFile = process.env.YT_DLP_COOKIES_FILE?.trim();
  if (cookiesFromBrowser) {
    args.push("--cookies-from-browser", cookiesFromBrowser);
  } else if (cookiesFile) {
    args.push("--cookies", cookiesFile);
  }

  return args;
}

/** Текущая версия yt-dlp (или null, если не установлен). */
export async function getYtDlpVersion(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("yt-dlp", ["--version"]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Обновляет yt-dlp через Homebrew. Возвращает версию до и после.
 * Главное лекарство от поломок YouTube — держать yt-dlp свежим.
 */
export async function updateYtDlp(): Promise<{ before: string | null; after: string | null }> {
  const before = await getYtDlpVersion();
  await execFileAsync("brew", ["upgrade", "yt-dlp"], {
    timeout: 5 * 60 * 1000,
    // brew может писать прогресс в stderr и раздувать буфер
    maxBuffer: 10 * 1024 * 1024,
  });
  const after = await getYtDlpVersion();
  return { before, after };
}

/** Название ролика без скачивания (для filename). */
export async function getYoutubeTitle(url: string): Promise<string> {
  await ensureYtDlp();
  const { stdout } = await execFileAsync("yt-dlp", [
    ...commonArgs(),
    "--print", "%(title)s",
    url,
  ]);
  return stdout.trim() || "youtube-audio";
}

// Разделитель полей в --progress-template. Парсим строки вида "PROGRESS|<pct>|<dl>|<total>|<speed>|<eta>".
const PROGRESS_TEMPLATE =
  "download:PROGRESS|%(progress._percent_str)s|%(progress.downloaded_bytes)s|" +
  "%(progress.total_bytes,progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s";

function num(s: string | undefined): number {
  if (!s || s === "NA") return 0;
  const n = parseFloat(s.replace("%", "").trim());
  return Number.isFinite(n) ? n : 0;
}

type ProgressHandlers = {
  onProgress: (p: DownloadProgress) => void;
  onPostprocess?: () => void;
};

/**
 * Запускает `yt-dlp <args>` через spawn и парсит построчный вывод: строки PROGRESS|…
 * (из --progress-template) → onProgress; строки постобработки ffmpeg ([Merger]/
 * [ExtractAudio]/[ffmpeg]) → onPostprocess. Резолвится по коду 0, иначе reject с хвостом
 * stderr. Прогресс может идти и в stdout, и в stderr — слушаем оба.
 */
function runYtDlpWithProgress(
  args: string[],
  { onProgress, onPostprocess }: ProgressHandlers
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("yt-dlp", args);
    let stderrTail = "";

    const handleLine = (line: string) => {
      if (line.startsWith("PROGRESS|")) {
        const [, pct, dl, total, speed, eta] = line.split("|");
        onProgress({
          percent: num(pct),
          downloaded: num(dl),
          total: num(total),
          speed: num(speed),
          eta: num(eta),
        });
      } else if (
        line.includes("[Merger]") ||
        line.includes("[ExtractAudio]") ||
        line.includes("[ffmpeg]")
      ) {
        onPostprocess?.();
      }
    };

    let buf = "";
    const onChunk = (data: Buffer) => {
      buf += data.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";
      for (const l of lines) handleLine(l);
    };
    child.stdout.on("data", onChunk);
    child.stderr.on("data", (d: Buffer) => {
      const s = d.toString();
      stderrTail = (stderrTail + s).slice(-2000);
      // прогресс может идти и в stderr в зависимости от версии
      const lines = s.split(/\r?\n/);
      for (const l of lines) handleLine(l);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (buf) handleLine(buf);
      if (code === 0) resolve();
      else reject(new Error(stderrTail.trim() || `yt-dlp завершился с кодом ${code}`));
    });
  });
}

/**
 * Скачивает лучшую аудиодорожку и конвертирует в m4a (destDir/<id>.m4a) через spawn,
 * отдавая прогресс скачивания в onProgress. После 100% идёт фаза извлечения аудио
 * (ffmpeg) — по ней прогресса нет, дёргается onPostprocess. Возвращает путь к файлу.
 */
export async function downloadYoutubeAudioWithProgress(
  url: string,
  destDir: string,
  id: string,
  onProgress: (p: DownloadProgress) => void,
  onPostprocess?: () => void
): Promise<string> {
  await ensureYtDlp();
  fs.mkdirSync(destDir, { recursive: true });

  const outTemplate = path.join(destDir, `${id}.%(ext)s`);
  const args = [
    ...commonArgs(),
    "-f", "bestaudio/best",
    "--extract-audio",
    "--audio-format", "m4a",
    "--newline",
    "--progress-template", PROGRESS_TEMPLATE,
    "-o", outTemplate,
    url,
  ];

  await runYtDlpWithProgress(args, { onProgress, onPostprocess });

  const finalPath = path.join(destDir, `${id}.m4a`);
  if (!fs.existsSync(finalPath)) {
    throw new Error("Не удалось скачать аудио с YouTube");
  }
  return finalPath;
}

export type VideoQuality = "best" | "1080p" | "720p" | "480p" | "audio";

/**
 * Формат yt-dlp по пресету. Видео-пресеты предпочитают уже-mp4/m4a потоки (merge ремуксом,
 * без перекодирования), с каскадным fallback на любые лучшие; audio тянет m4a напрямую.
 */
function formatArgsFor(quality: VideoQuality): string[] {
  if (quality === "audio") {
    return ["-f", "ba[ext=m4a]/ba/best", "--extract-audio", "--audio-format", "m4a"];
  }
  if (quality === "best") {
    return ["-f", "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b", "--merge-output-format", "mp4"];
  }
  const h = { "1080p": 1080, "720p": 720, "480p": 480 }[quality];
  return [
    "-f",
    `bv*[height<=${h}][ext=mp4]+ba[ext=m4a]/bv*[height<=${h}]+ba/b[height<=${h}]/b`,
    "--merge-output-format",
    "mp4",
  ];
}

/**
 * Скачивает видео (или только аудио) в выбранном качестве по точному outTemplate
 * (`<base>.%(ext)s`), отдавая прогресс. Запись в БД не делает — вызывающий сам знает
 * итоговый путь (контейнер фиксирован: mp4 для видео, m4a для audio).
 *
 * player_client по умолчанию tv (наш общий дефолт): проверено — отдаёт DASH-видео
 * всех высот до 4K, наш селектор скачивает video-only+audio и мержит в mp4. Override —
 * YT_DLP_VIDEO_PLAYER_CLIENT, если на каком-то ролике tv перестанет давать видео.
 */
export async function downloadYoutubeVideoWithProgress(
  url: string,
  outTemplate: string,
  quality: VideoQuality,
  { onProgress, onPostprocess }: ProgressHandlers
): Promise<void> {
  await ensureYtDlp();

  const videoClient = process.env.YT_DLP_VIDEO_PLAYER_CLIENT?.trim();
  const base = videoClient ? commonArgs({ playerClient: videoClient }) : commonArgs();

  const args = [
    ...base,
    ...formatArgsFor(quality),
    "--newline",
    "--progress-template", PROGRESS_TEMPLATE,
    "-o", outTemplate,
    url,
  ];

  await runYtDlpWithProgress(args, { onProgress, onPostprocess });
}
