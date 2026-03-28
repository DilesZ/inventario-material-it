import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { clearAllMovements, clearAllUnits } from "@/lib/inventory";

export async function POST(request: Request) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { target?: unknown };
    const target = typeof body?.target === "string" ? body.target : "";

    if (target === "units") {
      const result = await clearAllUnits();
      return NextResponse.json(result);
    }

    if (target === "movements") {
      const result = await clearAllMovements();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Acción administrativa no válida." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo reiniciar el inventario operativo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
