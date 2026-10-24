export async function GET() {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: "39.9042",
      longitude: "116.4074",
      current: "temperature_2m,weather_code,is_day",
      timezone: "Asia/Shanghai",
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error("Weather request failed");
    const data = (await response.json()) as {
      current?: { temperature_2m?: number; weather_code?: number; is_day?: number; time?: string };
    };
    const current = data.current;
    if (!current || typeof current.weather_code !== "number") throw new Error("Weather data unavailable");
    return Response.json(
      {
        temperature: typeof current.temperature_2m === "number" ? Math.round(current.temperature_2m) : null,
        code: current.weather_code,
        isDay: current.is_day === 1,
        time: current.time ?? null,
      },
      { headers: { "Cache-Control": "public, max-age=900, s-maxage=900, stale-while-revalidate=1800" } },
    );
  } catch {
    return Response.json({ error: "天气暂时不可用。" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
