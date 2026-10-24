import { asc, eq, like } from "drizzle-orm";
import { getDb } from "@/db";
import { isSiteOwner, ownerSessionFromCookieHeader } from "../../site-owner";
import { journalEntries } from "../../../db/schema";

const moods = new Set(["很开心", "平静", "有点累", "有点低落", "期待中", "感恩"]);

function validDay(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value);
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  try {
    const db = getDb();
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const rows = await db
        .select({ day: journalEntries.day })
        .from(journalEntries)
        .where(like(journalEntries.day, `${month}-%`));
      return Response.json(
        { days: [...new Set(rows.map((row) => row.day))] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const day = url.searchParams.get("day");
    if (!validDay(day)) return Response.json({ error: "日期格式不正确。" }, { status: 400 });
    const entries = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.day, day))
      .orderBy(asc(journalEntries.time), asc(journalEntries.id));
    return Response.json(
      { entries },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "日记暂时无法载入，请稍后再试。" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效。" }, { status: 403 });
  if (!(await isSiteOwner(ownerSessionFromCookieHeader(request.headers.get("cookie"))))) return Response.json({ error: "只有站主可以添加日记。" }, { status: 403 });

  let payload: { day?: unknown; mood?: unknown; note?: unknown; time?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "内容格式不正确。" }, { status: 400 });
  }

  const day = typeof payload.day === "string" ? payload.day : null;
  const mood = typeof payload.mood === "string" ? payload.mood : "";
  const note = typeof payload.note === "string" ? payload.note.trim() : "";
  const time = typeof payload.time === "string" && payload.time ? payload.time : null;
  if (!validDay(day)) return Response.json({ error: "请选择有效日期。" }, { status: 400 });
  if (!moods.has(mood)) return Response.json({ error: "请选择一种心情。" }, { status: 400 });
  if (!note || note.length > 1200) return Response.json({ error: "请写下内容（最多 1200 个字符）。" }, { status: 400 });
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return Response.json({ error: "时间格式不正确。" }, { status: 400 });

  try {
    const [entry] = await getDb()
      .insert(journalEntries)
      .values({ day, mood, note, time })
      .returning();
    return Response.json({ entry }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "保存失败，请稍后再试。" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效。" }, { status: 403 });
  if (!(await isSiteOwner(ownerSessionFromCookieHeader(request.headers.get("cookie"))))) return Response.json({ error: "只有站主可以删除日记。" }, { status: 403 });
  const idText = new URL(request.url).searchParams.get("id");
  const id = idText && /^\d+$/.test(idText) ? Number(idText) : 0;
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "记录编号无效。" }, { status: 400 });
  try {
    await getDb().delete(journalEntries).where(eq(journalEntries.id, id));
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "删除失败，请稍后再试。" }, { status: 503 });
  }
}
