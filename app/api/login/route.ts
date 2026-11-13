import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, timingSafeEqual } from "@/lib/session";

// Atraso simples por IP para dificultar força bruta.
const failures = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const f = failures.get(ip);
  if (f && f.until > Date.now()) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um minuto e tente de novo." }, { status: 429 });
  }
  const form = await req.formData();
  const user = String(form.get("user") || "");
  const pass = String(form.get("password") || "");
  const okUser = process.env.ADMIN_USER || "";
  const okPass = process.env.ADMIN_PASSWORD || "";
  if (!okUser || !okPass) {
    return NextResponse.json({ error: "ADMIN_USER e ADMIN_PASSWORD não estão configurados no servidor." }, { status: 500 });
  }
  if (!(timingSafeEqual(user, okUser) && timingSafeEqual(pass, okPass))) {
    const n = (f?.n || 0) + 1;
    failures.set(ip, { n, until: n >= 5 ? Date.now() + 60_000 : 0 });
    return NextResponse.json({ error: "Usuário ou senha não conferem." }, { status: 401 });
  }
  failures.delete(ip);
  const { value, maxAge } = await createSession(user);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge,
  });
  return res;
}
