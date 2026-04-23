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

---

## Быстрый старт

### Требования

- **Node.js** 18+ — [nodejs.org](https://nodejs.org/)
- **FFmpeg** — обязателен для обработки видео
- **npm** (входит в состав Node.js)
- API-ключ **Deepgram** (бесплатный план на [deepgram.com](https://deepgram.com/))
- API-ключ хотя бы одного провайдера суммаризации (см. ниже)

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

### Установка

**1. Клонируйте репозиторий:**

```bash
git clone https://github.com/Loag00233/TLDW-video-transcription-and-summarizer.git
cd TLDW-video-transcription-and-summarizer
```

**2. Установите зависимости:**

```bash
npm install
```

**3. Создайте файл с переменными окружения:**

```bash
cp .env.example .env.local
```

Если файла `.env.example` нет, создайте `.env.local` вручную:

```bash
touch .env.local
```

**4. Заполните `.env.local` своими ключами:**

```env
# Обязательно — транскрипция
DEEPGRAM_API_KEY=your_deepgram_api_key

# Провайдеры суммаризации — добавьте те, которыми планируете пользоваться

# Anthropic Claude (платно, высокое качество)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Groq (бесплатно, быстро — рекомендуется)
GROQ_API_KEY=your_groq_api_key

# Google Gemini (бесплатно)
GOOGLE_API_KEY=your_google_api_key

# DeepSeek (дёшево)
DEEPSEEK_API_KEY=your_deepseek_api_key
```

> Достаточно указать один провайдер суммаризации — не обязательно все.

---

### Запуск

#### Режим разработки

```bash
npm run dev
```

Приложение будет доступно по адресу: [http://localhost:3000](http://localhost:3000)

#### Продакшн-сборка

```bash
npm run build
npm run start
```

#### Автозапуск (с перезапуском при падении)

В корне проекта есть скрипт `start.sh`, который автоматически открывает браузер и перезапускает сервер при сбоях:

```bash
chmod +x start.sh
./start.sh
```

---

### Опционально: Ollama (локальные модели)

Для использования локальных моделей без отправки данных на внешние серверы:

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

После этого Ollama будет доступна по адресу `http://localhost:11434` — приложение подключится автоматически.

---

### Получение API-ключей

| Провайдер | Ссылка | Бесплатный план |
|-----------|--------|-----------------|
| Deepgram | [console.deepgram.com](https://console.deepgram.com/) | 200 часов |
| Groq | [console.groq.com](https://console.groq.com/) | Да |
| Google Gemini | [aistudio.google.com](https://aistudio.google.com/) | Да |
| Anthropic Claude | [console.anthropic.com](https://console.anthropic.com/) | Нет (платно) |
| DeepSeek | [platform.deepseek.com](https://platform.deepseek.com/) | $5 бонус |

---

## Лицензия

MIT © [Loag00233](https://github.com/Loag00233)
