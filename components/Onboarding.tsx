"use client";

import { useState } from "react";

interface Props {
  missingDeepgram: boolean;
  missingLlm: boolean;
  onComplete: () => void;
  compact?: boolean;
}

const DEEPGRAM_STEPS = [
  <>Открой <a href="https://console.deepgram.com/signup" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">console.deepgram.com/signup</a></>,
  <>Зарегистрируйся через Google или email — <span className="text-green-400">карта не нужна, сразу $200 кредит</span></>,
  <>После входа в верхнем левом углу кликни на название проекта → выбери <b>Settings</b></>,
  <>В настройках слева нажми вкладку <b>«API Keys»</b></>,
  <>Нажми кнопку <b>«Create a New API Key»</b></>,
  <>Введи любое название (например, <i>videotranscript</i>), Expiration оставь <b>«No expiration»</b>, нажми <b>«Create Key»</b></>,
  <>Скопируй ключ — <span className="text-yellow-400">он показывается только один раз, потом его не восстановить!</span></>,
];

const GROQ_STEPS = [
  <>Открой <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">console.groq.com</a></>,
  <>Нажми <b>«Log In»</b> → затем <b>«Sign up»</b> — зарегистрируйся через Google или email (<span className="text-green-400">бесплатно, карта не нужна</span>)</>,
  <>После входа в <b>верхней панели</b> навигации нажми <b>«API Keys»</b></>,
  <>Нажми кнопку <b>«Create API Key»</b></>,
  <>Введи любое название (например, <i>videotranscript</i>), в поле Expiration выбери <b>«No Expiration»</b></>,
  <>Нажми <b>«Submit»</b> → скопируй ключ</>,
];

export default function Onboarding({ missingDeepgram, missingLlm, onComplete }: Props) {
  const allConfigured = !missingDeepgram && !missingLlm;
  const [deepgramKey, setDeepgramKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    (!missingDeepgram || deepgramKey.trim().length > 10) &&
    (!missingLlm || groqKey.trim().length > 10);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const body: Record<string, string> = { llm_provider: "groq" };
    if (deepgramKey.trim()) body.deepgram_api_key = deepgramKey.trim();
    if (groqKey.trim()) body.groq_api_key = groqKey.trim();

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      onComplete();
    } else {
      setError("Не удалось сохранить. Попробуй ещё раз.");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {!allConfigured && (
        <p className="text-zinc-400 text-sm">
          Для начала работы нужно добавить 2 бесплатных ключа — это займёт около 3 минут
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* DeepGram card */}
        <SetupCard
          number="1"
          title="DeepGram — расшифровка речи"
          badge="$200 кредит · карта не нужна"
          badgeColor="text-green-400 bg-green-900/30"
          description="Превращает голос в текст. Точная расшифровка на русском и английском."
          steps={DEEPGRAM_STEPS}
          linkHref="https://deepgram.com"
          linkLabel="Открыть deepgram.com →"
          done={!missingDeepgram}
          inputValue={deepgramKey}
          onInputChange={setDeepgramKey}
          inputPlaceholder="Вставь DeepGram API ключ..."
        />

        {/* Groq card */}
        <SetupCard
          number="2"
          title="Groq — анализ и структурирование"
          badge="Бесплатно · без лимитов"
          badgeColor="text-green-400 bg-green-900/30"
          description="Читает транскрипт и создаёт краткое содержание, тезисы и список действий."
          steps={GROQ_STEPS}
          linkHref="https://console.groq.com"
          linkLabel="Открыть console.groq.com →"
          done={!missingLlm}
          inputValue={groqKey}
          onInputChange={setGroqKey}
          inputPlaceholder="Вставь Groq API ключ..."
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-base transition-colors"
        >
          {saving ? "Сохраняю..." : allConfigured ? "Обновить ключи" : "Сохранить и начать работу →"}
        </button>
        {!canSave && (
          <p className="text-xs text-zinc-500">
            Заполни оба поля выше чтобы продолжить
          </p>
        )}
      </div>
    </div>
  );
}

interface CardProps {
  number: string;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  steps: React.ReactNode[];
  linkHref: string;
  linkLabel: string;
  done: boolean;
  inputValue: string;
  onInputChange: (v: string) => void;
  inputPlaceholder: string;
}

function SetupCard({
  number, title, badge, badgeColor, description, steps,
  linkHref, linkLabel, done, inputValue, onInputChange, inputPlaceholder,
}: CardProps) {
  return (
    <div className={`bg-zinc-900 rounded-xl p-5 border space-y-4 ${done ? "border-green-700" : "border-zinc-700"}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {number}
            </span>
            <h2 className="font-semibold text-zinc-100">{title}</h2>
          </div>
          <p className="text-xs text-zinc-400 ml-8">{description}</p>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded shrink-0 font-medium ${badgeColor}`}>
          {badge}
        </span>
      </div>

      {done ? (
        <div className="flex items-center gap-2 text-green-400 text-sm bg-green-900/20 rounded-lg px-3 py-2.5">
          <span>✓</span>
          <span>Ключ уже установлен</span>
        </div>
      ) : (
        <>
          {/* Steps */}
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-zinc-300 leading-relaxed">
                <span className="shrink-0 w-5 h-5 rounded-full bg-zinc-800 text-zinc-500 text-[11px] flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          {/* Link */}
          <a
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {linkLabel}
          </a>

          {/* Input */}
          <div className="space-y-1.5">
            <input
              type="password"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={inputPlaceholder}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
            />
            {inputValue.length > 10 && (
              <p className="text-xs text-green-400">✓ Ключ добавлен</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
