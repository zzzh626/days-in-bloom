import { eq, lt, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { loginAttempts } from "@/db/schema";
import { createOwnerSession, getLoginRateKey, OWNER_SESSION_COOKIE, OWNER_SESSION_SECONDS, verifyAdminPassword } from "../../../site-owner";

const WINDOW_SECONDS = 15 * 60;
const IP_LIMIT = 5;
const GLOBAL_LIMIT = 10;

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

function lockedResponse(startedAt: number, now: number): Response {
  const retryAfter = Math.max(1, startedAt + WINDOW_SECONDS - now);
  return Response.json(
    { error: "尝试次数有点多，请稍后再试。" },
    { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfter) } },
  );
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效。" }, { status: 403 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 4096) return Response.json({ error: "请求内容太长。" }, { status: 413 });

  let payload: { username?: unknown; password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "登录内容格式不正确。" }, { status: 400 });
  }
  const username = typeof payload.username === "string" ? payload.username.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (username.length > 80 || password.length > 256) return Response.json({ error: "用户名或密码不正确。" }, { status: 401 });

  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - WINDOW_SECONDS;
  const ipAddress = request.headers.get("cf-connecting-ip") ?? "unknown";

  try {
    const db = getDb();
    await db.run(sql`CREATE TABLE IF NOT EXISTS login_attempts (client_key TEXT PRIMARY KEY NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, window_started_at INTEGER NOT NULL)`);
    await db.delete(loginAttempts).where(lt(loginAttempts.windowStartedAt, now - 24 * 60 * 60));
    const ipHash = await getLoginRateKey(ipAddress);
    if (!ipHash || !env.SITE_ADMIN_USERNAME) return Response.json({ error: "登录暂时不可用，请稍后再试。" }, { status: 503 });

    const keys = [
      { key: `ip:${ipHash}`, limit: IP_LIMIT },
      { key: "global", limit: GLOBAL_LIMIT },
    ];
    const existing = await Promise.all(keys.map(({ key }) => db.select().from(loginAttempts).where(eq(loginAttempts.clientKey, key)).get()));
    for (let index = 0; index < keys.length; index += 1) {
      const row = existing[index];
      if (row && row.windowStartedAt > windowStart && row.attempts >= keys[index].limit) return lockedResponse(row.windowStartedAt, now);
    }

    const passwordMatches = await verifyAdminPassword(password);
    const credentialsMatch = username === env.SITE_ADMIN_USERNAME && passwordMatches;
    if (credentialsMatch) {
      await Promise.all(keys.map(({ key }) => db.delete(loginAttempts).where(eq(loginAttempts.clientKey, key))));
      const token = await createOwnerSession();
      if (!token) return Response.json({ error: "登录暂时不可用，请稍后再试。" }, { status: 503 });
      const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
      return Response.json(
        { ok: true },
        {
          headers: {
            "Cache-Control": "no-store",
            "Set-Cookie": `${OWNER_SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${OWNER_SESSION_SECONDS}${secure}`,
          },
        },
      );
    }

    for (const { key } of keys) {
      await db.insert(loginAttempts).values({ clientKey: key, attempts: 1, windowStartedAt: now }).onConflictDoUpdate({
        target: loginAttempts.clientKey,
        set: {
          attempts: sql`CASE WHEN ${loginAttempts.windowStartedAt} <= ${windowStart} THEN 1 ELSE ${loginAttempts.attempts} + 1 END`,
          windowStartedAt: sql`CASE WHEN ${loginAttempts.windowStartedAt} <= ${windowStart} THEN ${now} ELSE ${loginAttempts.windowStartedAt} END`,
        },
      });
    }
    return Response.json({ error: "用户名或密码不正确。" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "登录暂时不可用，请稍后再试。" }, { status: 503 });
  }
}
