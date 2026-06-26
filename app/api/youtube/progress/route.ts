import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/ytJobs";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Не указан id" }, { status: 400 });
  }
  const job = getJob(id);
  if (!job) {
    // Задача неизвестна (ещё не создана или уже очищена) — пусть фронт подождёт/перестанет.
    return NextResponse.json({ status: "unknown" }, { status: 404 });
  }
  return NextResponse.json(job);
}
