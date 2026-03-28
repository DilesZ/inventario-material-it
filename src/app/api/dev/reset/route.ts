import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { databaseMode } from "@/lib/db";
import { clearDevelopmentMovements, clearDevelopmentUnits } from "@/lib/inventory";

export async function POST(request: Request) {
  if (databaseMode !== "local") {
    return NextResponse.json({ error: "Esta acción solo está disponible con base de datos local de desarrollo." }, { status: 403 });
  }

  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { target?: unknown };
    const target = typeof body?.target === "string" ? body.target : "";

    if (target === "units") {
      const result = await clearDevelopmentUnits();
      return NextResponse.json(result);
    }

    if (target === "movements") {
      const result = await clearDevelopmentMovements();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Acción de desarrollo no válida." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo reiniciar el inventario de desarrollo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
