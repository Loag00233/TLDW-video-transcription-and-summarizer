import { NextResponse } from "next/server";

export async function POST() {
  setTimeout(() => process.exit(0), 100);
  return NextResponse.json({ ok: true });
}
