# TLDW: Транскрибация и суммаризация видео

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)

## 📖 О проекте

**TLDW (Too Long; Didn't Watch)** — веб-приложение для автоматической транскрибации и суммаризации видео с использованием AI-технологий.

### 🎯 Возможности

-  Транскрибация видео через Deepgram API
-  Суммаризация контента через  Groq/ Claude/ Google / DeepSeek / Локальные модели
-  Экспорт структурированного вывода
-  Асинхронная обработка
-  Локальное хранение в SQLite

### 🛠 Технологии

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **AI/ML:**
  - **Deepgram** — транскрипция (аудио/видео → текст)
  - **Groq (Llama 3.3 70B)** — суммаризация (рекомендуется, бесплатно)
  - **Anthropic Claude** — суммаризация (высокое качество, платно)
  - **Google Gemini** — суммаризация (бесплатно)
  - **DeepSeek** — суммаризация (дешёво)
  - **Ollama** — локальные модели (приватно, бесплатно)
- **База данных:** SQLite
- **Видео обработка:** FFmpeg

## 🤖 Поддерживаемые AI провайдеры для суммаризации
TLDW поддерживает несколько AI-провайдеров для суммаризации текста. Вы можете выбрать тот, который лучше подходит для ваших задач:

| Провайдер | Модель | Стоимость | Качество | Для чего подходит |
|-----------|--------|-----------|----------|-------------------|
| **Groq** | Llama 3.3 70B | 🆓 Бесплатно | Высокое | Быстрая, точная, рекомендуется |
| **Google** | Gemini 2.0 Flash | 🆓 Бесплатно | Высокое | Бесплатный тариф с хорошим качеством |
| **DeepSeek** | V3 | 💰 Дешёвая | Среднее | Понимание кода, экономный вариант |
| **Anthropic** | Claude Sonnet | 💰 Платная | Очень высокое | Самая умная, сложные задачи |
| **Ollama** | Локальные модели | 🆓 Бесплатно | Разное | Локальный запуск, приватность |

## 🚀 Быстрый старт

### Требования

- Node.js 18+
- npm или yarn
- API ключи Deepgram и Anthropic (Claude)

### Установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/Loag00233/TLDW-video-transcription-and-summarizer.git
cd TLDW-video-transcription-and-summarizer
