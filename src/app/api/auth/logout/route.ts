import { NextResponse } from "next/server";
import { clearLoginSession } from "@/lib/auth";

export async function POST() {
  await clearLoginSession();
  return NextResponse.json({ ok: true });
}
