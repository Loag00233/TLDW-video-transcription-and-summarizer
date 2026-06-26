import { NextResponse } from "next/server";
import { updateYtDlp } from "@/lib/youtube";

// brew upgrade может идти дольше дефолтного лимита Next.
export const maxDuration = 300;

export async function POST() {
  try {
    const { before, after } = await updateYtDlp();
    const message =
      before === after
        ? `yt-dlp уже актуален (${after ?? "?"})`
        : `yt-dlp обновлён: ${before ?? "?"} → ${after ?? "?"}`;
    return NextResponse.json({ before, after, message });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Не удалось обновить yt-dlp";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
