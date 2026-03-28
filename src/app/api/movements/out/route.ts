import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { removeUnits } from "@/lib/inventory";

export async function POST(request: Request) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await removeUnits({
      slug: typeof body?.slug === "string" ? body.slug : "",
      quantity: Number(body?.quantity ?? 0),
      recipient: typeof body?.recipient === "string" ? body.recipient : "",
      movementDate: typeof body?.movementDate === "string" ? body.movementDate : "",
      serialNumbers: Array.isArray(body?.serialNumbers)
        ? body.serialNumbers.filter((value: unknown): value is string => typeof value === "string")
        : [],
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la salida.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
