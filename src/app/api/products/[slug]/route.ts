import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { getProductDetail } from "@/lib/inventory";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const { slug } = await params;
    const product = await getProductDetail(slug);
    return NextResponse.json({ product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cargar el detalle del producto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
