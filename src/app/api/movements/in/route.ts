import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { addUnits } from "@/lib/inventory";

export async function POST(request: Request) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await addUnits({
      slug: typeof body?.slug === "string" ? body.slug : "",
      quantity: Number(body?.quantity ?? 0),
      provider: typeof body?.provider === "string" ? body.provider : "",
      movementDate: typeof body?.movementDate === "string" ? body.movementDate : "",
      serialNumbers: Array.isArray(body?.serialNumbers)
        ? body.serialNumbers.filter((value: unknown): value is string => typeof value === "string")
        : [],
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la entrada.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
