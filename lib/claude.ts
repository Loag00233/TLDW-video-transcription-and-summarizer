import Anthropic from "@anthropic-ai/sdk";
import { formatTimecode } from "./time";
import type { TranscriptWord } from "./deepgram";

export interface StructuredOutput {
  summary: string;
  thesis: string[];
  notes: Array<{ timecode: string; text: string }>;
  actions: string[];
}

const structureTool: Anthropic.Tool = {
  name: "structure_transcript",
  description: "Structure the transcript into summary, thesis, notes and action items",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "2-4 sentence summary in the transcript's main language",
      },
      thesis: {
        type: "array",
        items: { type: "string" },
        description: "5-10 key points / thesis statements",
      },
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
        description: "Outline-style notes tied to timecodes from the transcript",
      },
      actions: {
        type: "array",
        items: { type: "string" },
        description: "Explicit TODOs / action items. Empty array if none.",
      },
    },
    required: ["summary", "thesis", "notes", "actions"],
  },
};

export async function structureTranscript(
  words: TranscriptWord[]
): Promise<StructuredOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });

  const transcriptText = words
    .map((w) => (w.start % 60 < 1 ? `[${formatTimecode(w.start)}] ${w.word}` : w.word))
    .join(" ");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    tools: [structureTool],
    tool_choice: { type: "tool", name: "structure_transcript" },
    messages: [
      {
        role: "user",
        content: `Structure the following transcript. It may be in Russian, English, or mixed. Respond in the same language as the transcript.\n\nTranscript:\n${transcriptText}`,
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return structured output");
  }

  return toolUse.input as StructuredOutput;
}
