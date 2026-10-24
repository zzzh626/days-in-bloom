import { OWNER_SESSION_COOKIE } from "../../../site-owner";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效。" }, { status: 403 });
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return Response.json({ ok: true }, {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": `${OWNER_SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`,
    },
  });
}
