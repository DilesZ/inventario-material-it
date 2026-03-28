import { NextResponse } from "next/server";
import { setLoginSession, validateCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = typeof body?.username === "string" ? body.username : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!validateCredentials(username, password)) {
      return NextResponse.json({ error: "Usuario o contrasena incorrectos." }, { status: 401 });
    }

    await setLoginSession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo iniciar sesion." }, { status: 400 });
  }
}
