import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const authCookieName = "traffic_admin_session";
export const authSessionMaxAge = 60 * 60 * 12;

export function createAuthSession(secret: string) {
  const expiresAt = Date.now() + authSessionMaxAge * 1000;
  const payload = `${expiresAt}.${randomBytes(18).toString("base64url")}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function isValidAuthSession(token: string, secret: string) {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const [expiresAtText, nonce] = payload.split(".");
  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() || !nonce || !signature) return false;

  const expected = createHmac("sha256", secret).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}