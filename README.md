# TLDW: Транскрибация и суммаризация видео

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)

## О проекте

**TLDW (Too Long; Didn't Watch)** — веб-приложение для автоматической транскрибации и суммаризации видео с использованием AI-технологий.

### Возможности

- Транскрибация видео через Deepgram API
- Суммаризация контента через Groq / Claude / Google / DeepSeek / Локальные модели
- Экспорт структурированного вывода
- Асинхронная обработка
- Локальное хранение в SQLite

### Технологии

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **AI/ML:**
  - **Deepgram** — транскрипция (аудио/видео → текст)
  - **Groq (Llama 3.3 70B)** — суммаризация (рекомендуется, бесплатно)
  - **Anthropic Claude** — суммаризация (высокое качество, платно)
  - **Google Gemini** — суммаризация (бесплатно)
  - **DeepSeek** — суммаризация (дёшево)
  - **Ollama** — локальные модели (приватно, бесплатно)
- **База данных:** SQLite
- **Видео обработка:** FFmpeg


## Поддерживаемые AI-провайдеры

| Провайдер | Модель | Стоимость | Для чего подходит |
|-----------|--------|-----------|-------------------|
| **Groq** | Llama 3.3 70B | Бесплатно | Быстрая, точная — рекомендуется |
| **Google Gemini** | Gemini 2.0 Flash | Бесплатно | Хорошее качество, бесплатный тариф |
| **DeepSeek** | V3 | Дёшево | Понимание кода, экономный вариант |
| **Anthropic Claude** | Claude Sonnet | Платно | Самая умная, сложные задачи |
| **Ollama** | Локальные модели | Бесплатно | Локальный запуск, полная приватность |

---

## Быстрый старт

### Требования

- **Node.js** 18+ — [nodejs.org](https://nodejs.org/)
- **FFmpeg** — обязателен для обработки видео

#### Установка FFmpeg

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg

# Windows (через winget)
winget install ffmpeg
```

---

### Установка и запуск

**1. Клонируйте репозиторий:**

```bash
git clone https://github.com/Loag00233/TLDW-video-transcription-and-summarizer.git
cd TLDW-video-transcription-and-summarizer
```

**2. Установите зависимости:**

```bash
npm install
```

**3. Запустите приложение:**

```bash
./start.sh
```

Скрипт автоматически откроет браузер на [http://localhost:3000](http://localhost:3000) и будет перезапускать сервер при сбоях.

---

### Настройка API-ключей

> Все ключи вводятся прямо в интерфейсе приложения — файлы конфигурации редактировать не нужно.

После запуска перейдите в раздел **Настройки** и введите ключи:

1. **Deepgram** — обязателен для транскрипции. Получить: [console.deepgram.com](https://console.deepgram.com/) (бесплатно, $200 кредит, карта не нужна)
2. **Провайдер суммаризации** — выберите любой один:
   - **Groq** — рекомендуется, бесплатно: [console.groq.com](https://console.groq.com/)
   - **Google Gemini** — бесплатно: [aistudio.google.com](https://aistudio.google.com/)
   - **DeepSeek** — дёшево: [platform.deepseek.com](https://platform.deepseek.com/)

Ключ сохраняется в локальную базу данных — вводить повторно не нужно.

#### Исключение: Anthropic Claude

Ключ Claude не хранится в UI — его нужно добавить вручную в файл `.env.local` в корне проекта:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
```

После этого перезапустите приложение (`./start.sh`). Получить ключ: [console.anthropic.com](https://console.anthropic.com/)

---

### Опционально: Ollama (локальные модели)

Для использования локальных моделей без передачи данных в интернет:

**1. Установите Ollama:**

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh
```

**2. Скачайте модель:**

```bash
ollama pull llama3.2
```

**3. Запустите Ollama:**

```bash
ollama serve
```

Затем в настройках приложения выберите провайдер **Ollama** и укажите модель. Ollama должна быть запущена на `http://localhost:11434`.

---

## Лицензия

MIT © [Loag00233](https://github.com/Loag00233)
