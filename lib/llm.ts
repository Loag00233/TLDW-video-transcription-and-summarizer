import OpenAI from "openai";
import { getDb } from "./db";
import { formatTimecode } from "./time";
import type { TranscriptWord } from "./deepgram";
import type { StructuredOutput } from "./claude";
import { PROVIDERS, type LLMProvider } from "./providers";

function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

const structureFunction = {
  name: "structure_transcript",
  description: "Structure the transcript into summary, thesis, notes and action items",
  parameters: {
    type: "object",
    properties: {
      summary: { type: "string", description: "2-4 sentence summary in the transcript's main language" },
      thesis: { type: "array", items: { type: "string" }, description: "5-10 key points" },
      notes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            timecode: { type: "string", description: "HH:MM:SS" },
            text: { type: "string" },
          },
          required: ["timecode", "text"],
        },
        description: "Outline notes tied to timecodes",
      },
      actions: { type: "array", items: { type: "string" }, description: "TODOs / action items, empty if none" },
    },
    required: ["summary", "thesis", "notes", "actions"],
  },
};

function buildTranscriptText(words: TranscriptWord[]): string {
  return words
    .map((w) => (w.start % 60 < 1 ? `[${formatTimecode(w.start)}] ${w.word}` : w.word))
    .join(" ");
}

async function structureViaOpenAICompat(
  words: TranscriptWord[],
  provider: LLMProvider,
  apiKey: string,
  baseURL: string,
  model: string
): Promise<StructuredOutput> {
  const client = new OpenAI({ apiKey, baseURL });
  const transcriptText = buildTranscriptText(words);

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: `Structure the following transcript. It may be in Russian, English, or mixed. Respond in the same language as the transcript.\n\nTranscript:\n${transcriptText}`,
      },
    ],
    tools: [{ type: "function", function: structureFunction }],
    tool_choice: { type: "function", function: { name: "structure_transcript" } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0] as
    | { function: { arguments: string } }
    | undefined;
  if (!toolCall) throw new Error(`${provider}: no tool call returned`);

  return JSON.parse(toolCall.function.arguments) as StructuredOutput;
}

async function structureViaAnthropic(words: TranscriptWord[]): Promise<StructuredOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set in .env.local");

  const { structureTranscript } = await import("./claude");
  return structureTranscript(words);
}

export async function structureWithLLM(words: TranscriptWord[]): Promise<{ output: StructuredOutput; modelLabel: string }> {
  const provider = (getSetting("llm_provider") ?? "groq") as LLMProvider;
  const config = PROVIDERS[provider];

  if (provider === "anthropic") {
    const output = await structureViaAnthropic(words);
    return { output, modelLabel: `anthropic/${config.defaultModel}` };
  }

  if (provider === "ollama") {
    const baseURL = getSetting("ollama_base_url") ?? config.baseURL!;
    const model = getSetting("ollama_model") ?? config.defaultModel;
    const output = await structureViaOpenAICompat(words, provider, "ollama", baseURL, model);
    return { output, modelLabel: `ollama/${model}` };
  }

  const keyName = `${provider}_api_key`;
  const apiKey = getSetting(keyName);
  if (!apiKey) throw new Error(`API key for ${config.label} not set. Add it in Settings.`);

  const output = await structureViaOpenAICompat(
    words,
    provider,
    apiKey,
    config.baseURL!,
    config.defaultModel
  );
  return { output, modelLabel: `${provider}/${config.defaultModel}` };
}
