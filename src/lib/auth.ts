import { createHash } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "inventory-material-session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function readEnvValue(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized || fallback;
}

const LOGIN_USERNAME = readEnvValue(process.env.APP_LOGIN_USER, "Sistemas");
const LOGIN_PASSWORD = readEnvValue(process.env.APP_LOGIN_PASSWORD, "Inicio2026");
const SESSION_SECRET = readEnvValue(process.env.APP_SESSION_SECRET, "inventario-material-it-2026");
const SESSION_VALUE = createHash("sha256")
  .update(`${SESSION_SECRET}:${LOGIN_USERNAME}:${LOGIN_PASSWORD}`)
  .digest("hex");

export function validateCredentials(username: string, password: string) {
  return username === LOGIN_USERNAME && password === LOGIN_PASSWORD;
}

export async function hasValidSession() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value === SESSION_VALUE;
}

export async function setLoginSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearLoginSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
