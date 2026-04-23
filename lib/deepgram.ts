import { createClient } from "@deepgram/sdk";
import fs from "fs";
import { getDb } from "@/lib/db";

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  speaker?: number;
}

export interface TranscriptResult {
  words: TranscriptWord[];
  fullText: string;
  language: string;
}

export async function transcribeAudio(
  audioPath: string,
  language: string = "multi"
): Promise<TranscriptResult> {
  let apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    const row = getDb().prepare("SELECT value FROM settings WHERE key = 'deepgram_api_key'").get() as { value: string } | undefined;
    apiKey = row?.value;
  }
  if (!apiKey) throw new Error("DeepGram API ключ не найден. Добавьте его в Settings.");

  const deepgram = createClient(apiKey);
  const audioBuffer = fs.readFileSync(audioPath);

  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    audioBuffer,
    {
      model: "nova-3",
      language: language === "multi" ? undefined : language,
      detect_language: true,
      smart_format: true,
      punctuate: true,
      diarize: true,
      utterances: true,
    }
  );

  if (error) throw new Error(`DeepGram error: ${error.message}`);

  const channel = result.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];

  const words: TranscriptWord[] =
    alternative?.words?.map((w) => ({
      word: w.punctuated_word ?? w.word,
      start: w.start,
      end: w.end,
      speaker: w.speaker,
    })) ?? [];

  return {
    words,
    fullText: alternative?.transcript ?? "",
    language: result.results?.channels?.[0]?.detected_language ?? language,
  };
}
