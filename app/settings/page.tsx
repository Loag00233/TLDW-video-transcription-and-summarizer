"use client";

import { useEffect, useState } from "react";
import { PROVIDERS, PROVIDER_LIST, type LLMProvider } from "@/lib/providers";

interface SettingsData {
  hasDeepGram: boolean;
  hasAnthropic: boolean;
  storage: { videoCount: number; videoBytes: number; audioCount: number };
  settings: Record<string, string>;
}

const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  groq: "Llama 3.3 70B — быстрая, точная, бесплатная",
  gemini: "Google Gemini 2.0 Flash — бесплатная",
  deepseek: "DeepSeek V3 — дешёвая, хорошо понимает код",
  anthropic: "Claude Sonnet — самая умная, платная",
  ollama: "Запускается локально на твоём Mac, без интернета",
};

const RECOMMENDED: LLMProvider = "groq";

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [provider, setProvider] = useState<LLMProvider>("groq");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [deepgramKey, setDeepgramKey] = useState("");
  const [ollamaModel, setOllamaModel] = useState("llama3.1");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434/v1");
  const [saved, setSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: SettingsData) => {
        setData(d);
        setProvider((d.settings.llm_provider ?? "groq") as LLMProvider);
        setOllamaModel(d.settings.ollama_model ?? "llama3.1");
        setOllamaUrl(d.settings.ollama_base_url ?? "http://localhost:11434/v1");
        setKeys({
          groq: d.settings.groq_api_key ?? "",
          deepseek: d.settings.deepseek_api_key ?? "",
          gemini: d.settings.gemini_api_key ?? "",
        });
      });
  }, []);

  const handleSave = async () => {
    const body: Record<string, string> = {
      llm_provider: provider,
      ollama_model: ollamaModel,
      ollama_base_url: ollamaUrl,
    };
    if (keys.groq) body.groq_api_key = keys.groq;
    if (keys.deepseek) body.deepseek_api_key = keys.deepseek;
    if (keys.gemini) body.gemini_api_key = keys.gemini;
    if (deepgramKey.trim()) body.deepgram_api_key = deepgramKey.trim();

    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const formatBytes = (b: number) => {
    if (b > 1e9) return `${(b / 1e9).toFixed(1)} GB`;
    if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`;
    return `${Math.round(b / 1e3)} KB`;
  };

  const mainProviders: LLMProvider[] = ["groq", "gemini", "deepseek", "anthropic"];
  const advancedProviders: LLMProvider[] = ["ollama"];

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">Настройки</h1>

      {/* DeepGram */}
      <section className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-zinc-100">DeepGram — расшифровка речи</h2>
            {data?.hasDeepGram
              ? <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded">✓ подключён</span>
              : <span className="text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded">не настроен</span>
            }
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Превращает голос в текст. Точный русский и английский.{" "}
            <a href="https://deepgram.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
              deepgram.com →
            </a>
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400">
            {data?.hasDeepGram ? "Обновить ключ" : "API ключ"}
          </label>
          <input
            type="password"
            placeholder={data?.hasDeepGram ? "••••••••••••• (уже установлен)" : "Вставь DeepGram API ключ..."}
            value={deepgramKey}
            onChange={(e) => setDeepgramKey(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
          />
          {!data?.hasDeepGram && (
            <a
              href="https://deepgram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Зарегистрироваться и получить ключ ($200 кредит, карта не нужна) →
            </a>
          )}
        </div>
      </section>

      {/* LLM Provider */}
      <section className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-4">
        <div>
          <h2 className="font-medium text-zinc-100">ИИ для анализа текста</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Читает транскрипт и создаёт краткое содержание, тезисы и список задач
          </p>
        </div>

        <div className="space-y-2">
          {mainProviders.map((p) => {
            const cfg = PROVIDERS[p];
            const isSelected = provider === p;
            const needsKey = cfg.keyRequired && p !== "anthropic";
            const hasKey =
              p === "anthropic"
                ? data?.hasAnthropic
                : !!keys[p];

            return (
              <label
                key={p}
                className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                  isSelected
                    ? "border-blue-500 bg-blue-950/30"
                    : "border-zinc-700 hover:border-zinc-600"
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value={p}
                  checked={isSelected}
                  onChange={() => setProvider(p)}
                  className="accent-blue-500 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-zinc-100 font-medium">{cfg.label}</span>
                    {p === RECOMMENDED && (
                      <span className="text-[10px] bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">
                        рекомендуется
                      </span>
                    )}
                    {cfg.free && (
                      <span className="text-[10px] bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded">
                        бесплатно
                      </span>
                    )}
                    {needsKey && hasKey && (
                      <span className="text-[10px] text-green-400">✓ ключ есть</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{PROVIDER_DESCRIPTIONS[p]}</p>
                </div>
              </label>
            );
          })}
        </div>

        {/* Key input for selected provider */}
        {provider !== "anthropic" && provider !== "ollama" && (
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">
              API ключ для {PROVIDERS[provider].label}
            </label>
            <input
              type="password"
              placeholder={keys[provider] ? "••••••••••••• (уже установлен)" : "Вставь ключ сюда..."}
              value={keys[provider] ?? ""}
              onChange={(e) => setKeys((k) => ({ ...k, [provider]: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
            />
            {!keys[provider] && (
              <a
                href={PROVIDERS[provider].signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Получить ключ на {PROVIDERS[provider].signupUrl.replace("https://", "")} →
              </a>
            )}
          </div>
        )}

        {provider === "anthropic" && (
          <div className="text-xs text-zinc-500 bg-zinc-800 rounded-lg px-3 py-2.5 space-y-1">
            <p>Ключ хранится в файле <code className="bg-zinc-700 px-1 rounded">.env.local</code> как <code className="bg-zinc-700 px-1 rounded">ANTHROPIC_API_KEY</code></p>
            {data?.hasAnthropic
              ? <p className="text-green-400">✓ ключ найден</p>
              : <p className="text-red-400">Ключ не найден — добавь в .env.local и перезапусти</p>
            }
          </div>
        )}

        {/* Advanced: Ollama */}
        <div>
          <button
            onClick={() => setShowAdvanced((p) => !p)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {showAdvanced ? "▾" : "▸"} Дополнительно (Ollama — локальный запуск)
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                  provider === "ollama"
                    ? "border-blue-500 bg-blue-950/30"
                    : "border-zinc-700 hover:border-zinc-600"
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value="ollama"
                  checked={provider === "ollama"}
                  onChange={() => setProvider("ollama")}
                  className="accent-blue-500 mt-0.5"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-100 font-medium">{PROVIDERS.ollama.label}</span>
                    <span className="text-[10px] bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded">бесплатно</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{PROVIDER_DESCRIPTIONS.ollama}</p>
                </div>
              </label>

              {provider === "ollama" && (
                <div className="space-y-3 pl-1">
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400">Модель</label>
                    <input
                      type="text"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400">Base URL</label>
                    <input
                      type="text"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saved ? "Сохранено ✓" : "Сохранить"}
        </button>
      </section>

      {/* Storage */}
      <section className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-3">
        <h2 className="font-medium text-zinc-100">Хранилище</h2>
        {data ? (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Видео</span>
              <span className="text-zinc-200">
                {data.storage.videoCount} файлов · {formatBytes(data.storage.videoBytes)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Аудио (временные)</span>
              <span className="text-zinc-200">{data.storage.audioCount} файлов</span>
            </div>
          </>
        ) : (
          <p className="text-zinc-500 text-sm">Загрузка...</p>
        )}
      </section>

      {/* Pricing */}
      <section className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-2">
        <h2 className="font-medium text-zinc-100">Стоимость</h2>
        <div className="text-sm space-y-1.5 text-zinc-400">
          <div className="flex justify-between">
            <span>DeepGram Nova-3 (расшифровка)</span>
            <span className="text-zinc-200">$0.0043/мин</span>
          </div>
          <div className="flex justify-between">
            <span>Groq Llama 3.3 70B (анализ)</span>
            <span className="text-green-400">бесплатно</span>
          </div>
          <div className="flex justify-between">
            <span>Google Gemini 2.0 Flash (анализ)</span>
            <span className="text-green-400">бесплатно</span>
          </div>
          <div className="flex justify-between">
            <span>Claude Sonnet (анализ)</span>
            <span className="text-zinc-200">~$0.01–0.05 за видео</span>
          </div>
        </div>
      </section>
    </div>
  );
}
