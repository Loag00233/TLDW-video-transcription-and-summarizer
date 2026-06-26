# ARCHITECTURE — TLDW / VideoTranscript

> Технический справочник «как устроен проект» для быстрого восстановления контекста.
> README.md — для пользователя (установка/запуск), ROADMAP.md — планы фич, **этот файл — про код и архитектуру**.
> При изменении архитектуры — обновляй этот файл (см. раздел «Журнал изменений» внизу).

## Что это

Локальное веб-приложение для транскрибации и суммаризации видео/аудио. Поток:
**Загрузка → выбор сегментов на таймлайне → транскрипция (DeepGram) → структурирование (LLM)**.
Идея сегментов: платить за расшифровку только нужных кусков, а не всего видео.

## Стек

- **Next.js 16** (App Router) + React + TypeScript + Tailwind
- **SQLite** через `better-sqlite3` (`storage/app.db`, WAL-режим)
- **ffmpeg / ffprobe** — извлечение аудио и длительность (должны быть в PATH)
- **DeepGram Nova-3** — транскрипция (RU/EN/`multi` code-switching)
- **Мульти-провайдер LLM** для суммаризации: Groq, DeepSeek, Gemini, Anthropic Claude, Ollama
- **yt-dlp + Deno** — скачивание аудио с YouTube

## Структура

```
app/
  page.tsx              — главная (библиотека видео)
  upload/page.tsx       — загрузка: drag-drop (локально) + поле URL (YouTube-аудио → расшифровка)
  download/page.tsx     — скачивание видео с YouTube в ~/Movies с выбором качества (download-manager)
  videos/[id]/page.tsx  — экран видео: SegmentPicker → транскрипт → структура
  settings/page.tsx     — выбор LLM-провайдера и ввод ключей
  api/
    upload/             — локальный импорт ПО ССЫЛКЕ (см. «Хранение»)
    youtube/            — старт фоновой загрузки YouTube-аудио для расшифровки (возвращает jobId)
    youtube/download/   — старт фонового скачивания видео в ~/Movies (download-manager, без записи в БД)
    youtube/progress/   — опрос прогресса скачивания, генерик по jobId (polling)
    youtube/maintenance/— кнопка «Обновить yt-dlp» (brew upgrade)
    transcribe/         — извлечение сегментов + DeepGram
    structure/          — суммаризация через выбранный LLM
    stream/[id]/        — отдача медиа в браузер (HTTP range)
    videos/, videos/[id]/ — список/детали/удаление
    settings/           — чтение/запись ключей и провайдера
    debug/, restart/    — служебные
components/
  SegmentPicker.tsx     — ЯДРО UX: таймлайн, IN/OUT маркеры, список сегментов, оценка $
  TranscriptView.tsx    — транскрипт с кликабельными таймкодами
  StructuredOutput.tsx  — Summary / Thesis / Notes / Actions
  ClientShell, Onboarding, DebugPanel
lib/
  db.ts        — инициализация SQLite + схема
  ffmpeg.ts    — extractSegments(), getVideoDuration(), remapTimestamps()
  deepgram.ts  — transcribeAudio()
  providers.ts — конфиг LLM-провайдеров (PROVIDERS)
  llm.ts       — единый вызов LLM (OpenAI-совместимый для groq/deepseek/gemini/ollama)
  claude.ts    — структурирование через Anthropic (tool_use → гарантированный JSON)
  youtube.ts   — yt-dlp: проверка, скачивание аудио/видео с прогрессом (runYtDlpWithProgress), getYoutubeTitle, updateYtDlp
  ytJobs.ts    — in-memory хранилище прогресса YouTube-загрузок (для polling)
  paths.ts     — MEDIA_DIR (источник правды) + sanitizeFilename/uniqueBaseName для имён скачанных файлов
  format.ts    — fmtBytes/fmtTime для UI прогресса
  time.ts      — форматирование таймкодов
storage/
  app.db       — SQLite (видео, транскрипты, структуры, настройки)
  audio/       — скачанное с YouTube аудио (<id>.m4a) + temp WAV при извлечении сегментов
  videos/      — (устар.) раньше тут лежали копии загруженных файлов; теперь не используется
```

## Хранение медиа (важно — менялось)

- **Локальные файлы:** НЕ копируются. Drag-drop отдаёт только `file.name`; `/api/upload` принимает JSON `{ name }`, ищет файл по имени в `LOCAL_MEDIA_DIR` (env, дефолт `/Users/macbook/Movies`, рекурсивный ручной обход с пропуском защищённых папок типа `~/Movies/TV`/EPERM), и пишет в БД **путь к оригиналу**. Несколько совпадений → 409, имена в папке должны быть уникальны.
- **YouTube:** аудио качается в `storage/audio/<id>.m4a`, в БД путь на него.
- **Почему без копий:** `extractSegments(video.path, …)` запускает ffmpeg прямо на `video.path` в момент расшифровки (temp WAV 16кГц моно → DeepGram → temp удаляется). Само хранилище нужно только как источник для ffmpeg. `/api/stream/[id]` отдаёт `video.path` с range-запросами — работает с любым абсолютным путём.

## Пайплайн данных

1. **Импорт** → строка в `videos` (`path` указывает на оригинал/скачанное аудио).
2. **Выбор сегментов** (SegmentPicker) → массив `{start,end}`.
3. **POST /api/transcribe** → `extractSegments` режет/склеивает аудио → `transcribeAudio` (DeepGram) → `remapTimestamps` восстанавливает оригинальные таймкоды → строка в `transcriptions` (`status: processing|done|error`). Оценка стоимости: `$0.0043/мин`.
4. **POST /api/structure** → выбранный LLM делает Summary/Thesis/Notes/Actions → строка в `structured_outputs`.

## Схема БД (`storage/app.db`)

- **videos**(id, filename, path, duration_sec, language, created_at)
- **transcriptions**(id, video_id→videos CASCADE, segments_json, transcript_json, audio_duration_sec, cost_estimate_usd, status, created_at)
- **structured_outputs**(id, transcription_id→transcriptions CASCADE, summary, thesis_json, notes_json, actions_json, model, created_at)
- **settings**(key, value) — ключи API и выбранный провайдер

## Ключи / конфиг

- `.env.local`: `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`, опц. `YT_DLP_COOKIES_FROM_BROWSER`, `YT_DLP_PLAYER_CLIENT` (аудио, дефолт `tv`), `YT_DLP_VIDEO_PLAYER_CLIENT` (видео-скачивание, дефолт `android_vr`), `YT_DLP_PROXY`, `LOCAL_MEDIA_DIR`.
- Ключи остальных LLM-провайдеров и выбор провайдера хранятся в таблице `settings` (вводятся в UI).

## YouTube-загрузка (детали)

- Рабочая связка (2026): `--cookies-from-browser chrome` + `--extractor-args youtube:player_client=tv` (прямой https-поток, аудио, быстро, без 403) + Deno (решение JS-челленджей). При поломке — `brew upgrade yt-dlp` (кнопка на /upload).
- Скачивание идёт **в фоне** через `spawn`, прогресс парсится из `--progress-template` и кладётся в `ytJobs` (in-memory, singleton через globalThis). Фронт опрашивает `/api/youtube/progress?id=` раз в секунду и рисует прогресс-бар. Прогресс не переживает перезапуск сервера (ок для локалки).
- Общий движок `runYtDlpWithProgress(args, handlers)` в `lib/youtube.ts` используют обе функции: `downloadYoutubeAudioWithProgress` (аудио-флоу) и `downloadYoutubeVideoWithProgress` (download-флоу).

## Скачивание видео (download-флоу, `/download`)

- Отдельный **download-manager**: качает само видео в выбранном качестве в `~/Movies` и оставляет его себе; запись в `videos` НЕ создаётся (в отличие от аудио-флоу `/api/youtube`, который сразу пишет в БД и открывает расшифровку).
- Поток: `/download` → `POST /api/youtube/download { url, quality }` → фоновое скачивание, прогресс в `ytJobs` → опрос того же `/api/youtube/progress?id=` → по `done` показываем `savedPath` + кнопку «Расшифровать», которая дёргает существующий `/api/upload { name }` и редиректит на `/videos/<id>`.
- **Имя файла известно заранее:** роут берёт `getYoutubeTitle`, `sanitizeFilename` (чистка + лимит длины), `uniqueBaseName` (суффикс ` (N)` против перезаписи) и передаёт yt-dlp точный `-o "<base>.%(ext)s"`. Контейнер фиксирован пресетом (`mp4` для видео, `m4a` для `audio`), поэтому `savedPath` известен до старта.
- **Пресеты → формат:** `best`/`1080p`/`720p`/`480p` → `bv*[…][ext=mp4]+ba[ext=m4a]/…` + `--merge-output-format mp4` (предпочитаем mp4/m4a-потоки, чтобы merge шёл ремуксом без перекодирования); `audio` → `--extract-audio --audio-format m4a`.
- **player_client:** видео по умолчанию `android_vr` (не требует PO-токена, не DRM-залочен), а не `tv` (без cookies DRM-залочен и отдаёт только аудио). Override — `YT_DLP_VIDEO_PLAYER_CLIENT`. Аудио-флоу остаётся на `tv`.

## Журнал изменений (архитектурно значимое)

- **2026-06-26** — Добавлен download-флоу: страница `/download` + `POST /api/youtube/download` качают видео в `~/Movies` с выбором качества (пресеты `Лучшее/1080p/720p/480p/Только аудио`), без записи в БД; «Расшифровать» переиспользует `/api/upload`. Новые `lib/paths.ts` (`MEDIA_DIR` вынесен из `/api/upload`, `sanitizeFilename`, `uniqueBaseName`) и `lib/format.ts` (`fmtBytes`/`fmtTime`, вынесены из `/upload`). `lib/youtube.ts`: общий движок `runYtDlpWithProgress`, параметризованный `player_client` (видео → `android_vr`, env `YT_DLP_VIDEO_PLAYER_CLIENT`), функция `downloadYoutubeVideoWithProgress`. Ссылка «Скачать» в шапке.
- **2026-06-26** — Локальные файлы перестали копироваться: `/api/upload` теперь резолвит файл по имени в `LOCAL_MEDIA_DIR` и хранит ссылку на оригинал. YouTube-аудио переехало в `storage/audio`. Добавлены прогресс-бар скачивания (polling через `ytJobs`), кнопки «Обновить куки»/«Обновить yt-dlp» на /upload. Удалена мёртвая `downloadYoutubeAudio` (заменена на `…WithProgress`). Очищены старые копии в `storage/videos` (~10 ГБ) — остались только транскрипты в БД.
