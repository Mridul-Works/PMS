// Signed session token, using Web Crypto so it works in middleware and on the server.
// Format: base64url(JSON {uid, exp}) + "." + base64url(HMAC-SHA256)

export const SESSION_COOKIE = "pms_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET is missing or too short. Set it in .env");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(uid: number) {
  const payload = b64url(enc.encode(JSON.stringify({ uid, exp: Date.now() + SESSION_DAYS * 864e5 })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

/** Returns the user id if the token is valid and not expired. */
export async function verifySession(token?: string): Promise<number | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), fromB64url(sig), enc.encode(payload));
    if (!ok) return null;
    const { uid, exp } = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    return typeof uid === "number" && exp > Date.now() ? uid : null;
  } catch {
    return null;
  }
}
