import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { resetDevelopmentInventory } from "@/lib/inventory";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Esta acción solo está disponible en desarrollo." }, { status: 403 });
  }

  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const result = await resetDevelopmentInventory();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo reiniciar el inventario de desarrollo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
