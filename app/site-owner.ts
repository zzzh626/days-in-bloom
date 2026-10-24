import { env } from "cloudflare:workers";

export const OWNER_SESSION_COOKIE = "site_owner_session";
export const OWNER_SESSION_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmac(value: string, secret: string): Promise<string | null> {
  if (!secret) return null;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function createOwnerSession(): Promise<string | null> {
  const expiresAt = Math.floor(Date.now() / 1000) + OWNER_SESSION_SECONDS;
  const signature = await hmac(String(expiresAt), env.SITE_SESSION_SECRET ?? "");
  return signature ? `${expiresAt}.${signature}` : null;
}

export async function isSiteOwner(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const [expiryText, suppliedSignature, ...extra] = token.split(".");
  if (!expiryText || !suppliedSignature || extra.length) return false;
  const expiresAt = Number(expiryText);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + OWNER_SESSION_SECONDS + 60) return false;
  const expectedText = await hmac(expiryText, env.SITE_SESSION_SECRET ?? "");
  const supplied = decodeBase64Url(suppliedSignature);
  const expected = expectedText ? decodeBase64Url(expectedText) : null;
  return Boolean(supplied && expected && constantTimeEqual(supplied, expected));
}

export function ownerSessionFromCookieHeader(cookieHeader: string | null): string | null {
  const prefix = `${OWNER_SESSION_COOKIE}=`;
  const cookie = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return cookie ? cookie.slice(prefix.length) : null;
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const stored = env.SITE_ADMIN_PASSWORD_HASH ?? "";
  const [version, roundsText, saltText, hashText, ...extra] = stored.split("$");
  const rounds = Number(roundsText);
  const salt = saltText ? decodeBase64Url(saltText) : null;
  const expected = hashText ? decodeBase64Url(hashText) : null;
  if (version !== "pbkdf2-sha256" || extra.length || !Number.isSafeInteger(rounds) || rounds < 100_000 || rounds > 1_000_000 || !salt || salt.length < 16 || !expected || expected.length !== 32) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds }, key, 256));
  return constantTimeEqual(actual, expected);
}

export async function getLoginRateKey(ipAddress: string): Promise<string | null> {
  return hmac(`login-rate:${ipAddress}`, env.SITE_SESSION_SECRET ?? "");
}
