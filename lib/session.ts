// Sessão assinada com HMAC (Web Crypto) — funciona no middleware (edge) e no Node.
export const SESSION_COOKIE = "citacs_session";
const MAX_AGE_S = 60 * 60 * 12;

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function key(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET ausente ou curto (mín. 16 caracteres)");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function sign(data: string): Promise<string> {
  return b64url(await crypto.subtle.sign("HMAC", await key(), enc.encode(data)));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession(user: string): Promise<{ value: string; maxAge: number }> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  const payload = b64url(enc.encode(JSON.stringify({ u: user, exp })));
  return { value: `${payload}.${await sign(payload)}`, maxAge: MAX_AGE_S };
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    if (!timingSafeEqual(sig, await sign(payload))) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const { u, exp } = JSON.parse(json) as { u: string; exp: number };
    if (typeof exp !== "number" || exp < Date.now() / 1000) return null;
    return u;
  } catch {
    return null;
  }
}
