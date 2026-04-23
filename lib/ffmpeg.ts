import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";

const execFileAsync = promisify(execFile);

export interface Segment {
  start: number;
  end: number;
}

export interface SegmentOffset {
  start: number;
  audioStart: number;
  audioEnd: number;
}

export interface ExtractResult {
  audioPath: string;
  offsets: SegmentOffset[];
  totalDuration: number;
}

export async function getVideoDuration(videoPath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    videoPath,
  ]);
  return parseFloat(stdout.trim());
}

export async function extractSegments(
  videoPath: string,
  segments: Segment[]
): Promise<ExtractResult> {
  const hash = randomBytes(6).toString("hex");
  const audioDir = path.join(process.cwd(), "storage", "audio");
  fs.mkdirSync(audioDir, { recursive: true });

  const offsets: SegmentOffset[] = [];
  const partPaths: string[] = [];
  let audioTime = 0;

  for (let i = 0; i < segments.length; i++) {
    const { start, end } = segments[i];
    const duration = end - start;
    const partPath = path.join(audioDir, `part-${hash}-${i}.wav`);

    await execFileAsync("ffmpeg", [
      "-y",
      "-ss", String(start),
      "-t", String(duration),
      "-i", videoPath,
      "-vn",
      "-acodec", "pcm_s16le",
      "-ar", "16000",
      "-ac", "1",
      partPath,
    ]);

    offsets.push({
      start,
      audioStart: audioTime,
      audioEnd: audioTime + duration,
    });
    audioTime += duration;
    partPaths.push(partPath);
  }

  const outputPath = path.join(audioDir, `${hash}.wav`);

  if (partPaths.length === 1) {
    fs.renameSync(partPaths[0], outputPath);
  } else {
    const listPath = path.join(audioDir, `${hash}.txt`);
    fs.writeFileSync(listPath, partPaths.map((p) => `file '${p}'`).join("\n"));
    await execFileAsync("ffmpeg", [
      "-y", "-f", "concat", "-safe", "0",
      "-i", listPath,
      "-c", "copy",
      outputPath,
    ]);
    fs.unlinkSync(listPath);
    partPaths.forEach((p) => fs.existsSync(p) && fs.unlinkSync(p));
  }

  return { audioPath: outputPath, offsets, totalDuration: audioTime };
}

export function remapTimestamps(
  words: Array<{ start: number; end: number; word: string; speaker?: number }>,
  offsets: SegmentOffset[]
): Array<{ start: number; end: number; word: string; speaker?: number }> {
  return words.map((w) => {
    const offset = offsets.find(
      (o) => w.start >= o.audioStart && w.start < o.audioEnd
    );
    if (!offset) return w;
    const shift = offset.start - offset.audioStart;
    return { ...w, start: w.start + shift, end: w.end + shift };
  });
}
