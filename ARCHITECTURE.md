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
  upload/page.tsx       — загрузка: drag-drop (локально) + поле URL (YouTube)
  videos/[id]/page.tsx  — экран видео: SegmentPicker → транскрипт → структура
  settings/page.tsx     — выбор LLM-провайдера и ввод ключей
  api/
    upload/             — локальный импорт ПО ССЫЛКЕ (см. «Хранение»)
    youtube/            — старт фоновой загрузки с YouTube (возвращает jobId)
    youtube/progress/   — опрос прогресса скачивания (polling)
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
  youtube.ts   — yt-dlp: проверка, скачивание с прогрессом, getYoutubeTitle, updateYtDlp
  ytJobs.ts    — in-memory хранилище прогресса YouTube-загрузок (для polling)
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

- `.env.local`: `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`, опц. `YT_DLP_COOKIES_FROM_BROWSER`, `YT_DLP_PLAYER_CLIENT`, `YT_DLP_PROXY`, `LOCAL_MEDIA_DIR`.
- Ключи остальных LLM-провайдеров и выбор провайдера хранятся в таблице `settings` (вводятся в UI).

## YouTube-загрузка (детали)

- Рабочая связка (2026): `--cookies-from-browser chrome` + `--extractor-args youtube:player_client=tv` (прямой https-поток, аудио, быстро, без 403) + Deno (решение JS-челленджей). При поломке — `brew upgrade yt-dlp` (кнопка на /upload).
- Скачивание идёт **в фоне** через `spawn`, прогресс парсится из `--progress-template` и кладётся в `ytJobs` (in-memory, singleton через globalThis). Фронт опрашивает `/api/youtube/progress?id=` раз в секунду и рисует прогресс-бар. Прогресс не переживает перезапуск сервера (ок для локалки).

## Журнал изменений (архитектурно значимое)

- **2026-06-26** — Локальные файлы перестали копироваться: `/api/upload` теперь резолвит файл по имени в `LOCAL_MEDIA_DIR` и хранит ссылку на оригинал. YouTube-аудио переехало в `storage/audio`. Добавлены прогресс-бар скачивания (polling через `ytJobs`), кнопки «Обновить куки»/«Обновить yt-dlp» на /upload. Удалена мёртвая `downloadYoutubeAudio` (заменена на `…WithProgress`). Очищены старые копии в `storage/videos` (~10 ГБ) — остались только транскрипты в БД.
