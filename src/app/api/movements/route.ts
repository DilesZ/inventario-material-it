import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { getMovementTimeline } from "@/lib/inventory";

export async function GET() {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const data = await getMovementTimeline();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron cargar los movimientos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
