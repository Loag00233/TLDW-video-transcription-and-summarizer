import path from "path";
import fs from "fs";

// Папка с локальными медиа. Файлы НЕ копируются — в БД хранится ссылка на оригинал,
// а скачанные с YouTube видео кладутся сюда же. Один источник правды для всех роутов.
export const MEDIA_DIR = process.env.LOCAL_MEDIA_DIR?.trim() || "/Users/macbook/Movies";

// Символы, запрещённые в именах файлов на распространённых ФС (Windows строже всех).
const FORBIDDEN = /[/\\:*?"<>|\x00-\x1f]/g;

// Лимит длины базового имени (без расширения). Большинство ФС держат 255 байт на имя;
// оставляем запас под суффикс " (N)" и расширение. yt-dlp FAQ предупреждает, что длинные
// %(title)s упираются в этот лимит.
const MAX_BASE_LENGTH = 180;

/** Чистит строку до безопасного имени файла (без расширения). */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(FORBIDDEN, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_BASE_LENGTH)
    .trim();
  return cleaned || "youtube-video";
}

/**
 * Возвращает базовое имя, для которого `dir/base.ext` не существует:
 * `base`, либо `base (1)`, `base (2)`, … Существующие файлы не трогаются.
 */
export function uniqueBaseName(dir: string, base: string, ext: string): string {
  if (!fs.existsSync(path.join(dir, `${base}.${ext}`))) return base;
  for (let i = 1; ; i++) {
    const candidate = `${base} (${i})`;
    if (!fs.existsSync(path.join(dir, `${candidate}.${ext}`))) return candidate;
  }
}
