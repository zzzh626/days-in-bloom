"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Entry = { id: number; day: string; mood: string; note: string; time: string | null; createdAt: string };
type Weather = { temperature: number | null; code: number; isDay: boolean; time: string | null };

const moods = ["很开心", "平静", "有点累", "有点低落", "期待中", "感恩"];
const moodMarks: Record<string, string> = { 很开心: "☀", 平静: "☁", 有点累: "☾", 有点低落: "☂", 期待中: "✿", 感恩: "♡" };
const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
const stars = [
  [7, 9, 0.4], [18, 17, 1.8], [31, 7, 2.6], [43, 21, 1.2], [57, 11, 3.1],
  [69, 25, 0.8], [83, 10, 2.1], [94, 19, 1.5], [12, 34, 2.8], [25, 29, 0.2],
  [39, 39, 1.7], [52, 32, 2.4], [64, 43, 0.5], [77, 36, 3.3], [89, 45, 1.1],
  [5, 53, 2.2], [21, 49, 0.9], [35, 59, 3.0], [48, 53, 1.4], [72, 58, 2.7],
  [86, 63, 0.6], [96, 55, 1.9], [14, 70, 3.2], [59, 68, 0.3],
];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getPeriod(date: Date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 10) return "morning";
  if (hour >= 10 && hour < 16) return "day";
  if (hour >= 16 && hour < 19) return "evening";
  return "night";
}

function weatherLabel(code: number) {
  if (code === 0) return "晴朗";
  if (code === 1) return "大致晴朗";
  if (code === 2) return "局部多云";
  if (code === 3) return "阴天";
  if (code === 45 || code === 48) return "雾";
  if (code >= 51 && code <= 67) return "有雨";
  if (code >= 71 && code <= 77) return "有雪";
  if (code >= 80 && code <= 82) return "阵雨";
  if (code >= 85 && code <= 86) return "阵雪";
  if (code >= 95) return "雷雨";
  return "北京天气";
}

function weatherMood(code: number) {
  if (code >= 51 && code <= 67 || code >= 80 && code <= 82 || code >= 95) return "rain";
  if (code >= 71 && code <= 86) return "snow";
  if (code === 45 || code === 48 || code === 3) return "cloudy";
  return "clear";
}

export function JournalApp({
  canEdit,
  initialDate,
}: {
  canEdit: boolean;
  initialDate: string;
}) {
  const [today, setToday] = useState(() => new Date(`${initialDate}T12:00:00`));
  const [month, setMonth] = useState(() => new Date(`${initialDate}T12:00:00`));
  const [selectedDay, setSelectedDay] = useState(initialDate);
  const [period, setPeriod] = useState(() => getPeriod(new Date(`${initialDate}T12:00:00`)));
  const [weather, setWeather] = useState<Weather | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [markedDays, setMarkedDays] = useState<Set<string>>(new Set());
  const [mood, setMood] = useState("平静");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [flowerCount, setFlowerCount] = useState(0);
  const [flowerBurst, setFlowerBurst] = useState(0);
  const [rainbow, setRainbow] = useState(false);
  const [meteor, setMeteor] = useState(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  async function loginOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "登录失败，请稍后再试。");
      window.location.reload();
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "登录失败，请稍后再试。");
      setAuthBusy(false);
    }
  }

  async function logoutOwner() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const calendarCells = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const count = new Date(year, monthIndex + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  }, [month]);

  useEffect(() => {
    const actualNow = new Date();
    setToday(actualNow);
    setMonth(actualNow);
    setSelectedDay(dateKey(actualNow));
    const tick = () => {
      const current = new Date();
      setToday(current);
      setPeriod(getPeriod(current));
    };
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const readWeather = async () => {
      try {
        const response = await fetch("/api/weather", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as Weather;
        if (active) setWeather(data);
      } catch {
        // Keep the clock-based atmosphere when the weather service is unavailable.
      }
    };
    void readWeather();
    const refresh = window.setInterval(readWeather, 30 * 60_000);
    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/schedule?day=${encodeURIComponent(selectedDay)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { entries?: Entry[]; error?: string };
        if (!response.ok) throw new Error(data.error || "日记暂时无法载入。");
        if (active) setEntries(data.entries ?? []);
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "日记暂时无法载入。");
      });
    return () => { active = false; };
  }, [selectedDay]);

  useEffect(() => {
    let active = true;
    fetch(`/api/schedule?month=${monthKey}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { days?: string[] }) => {
        if (active) setMarkedDays(new Set(data.days ?? []));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [monthKey]);

  useEffect(() => {
    if (!weather) return;
    const rainy = weatherMood(weather.code) === "rain";
    if (Math.random() < (rainy ? 0.34 : 0.14)) setRainbow(true);
  }, [weather]);

  useEffect(() => {
    if (period !== "night") return;
    const showMeteor = () => {
      setMeteor((value) => value + 1);
      window.setTimeout(() => setMeteor((value) => Math.max(0, value - 1)), 1800);
    };
    if (Math.random() < 0.24) window.setTimeout(showMeteor, 900);
    const timer = window.setInterval(() => {
      if (Math.random() < 0.24) showMeteor();
    }, 16_000);
    return () => window.clearInterval(timer);
  }, [period]);

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!note.trim()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: selectedDay, mood, note: note.trim(), time: time || null }),
      });
      const data = (await response.json()) as { entry?: Entry; error?: string };
      if (!response.ok || !data.entry) throw new Error(data.error || "保存失败，请稍后再试。");
      setEntries((existing) => [...existing, data.entry!].sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99") || a.id - b.id));
      setMarkedDays((existing) => new Set([...existing, selectedDay]));
      setNote("");
      setTime("");
      setMessage("已保存，这一天的记录已同步给访客。 ✿");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败，请稍后再试。");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: number) {
    setMessage("");
    try {
      const response = await fetch(`/api/schedule?id=${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "删除失败，请稍后再试。");
      setEntries((existing) => existing.filter((entry) => entry.id !== id));
      setMessage("这条记录已删除。");
      const remaining = entries.filter((entry) => entry.id !== id);
      if (!remaining.length) {
        setMarkedDays((existing) => {
          const next = new Set(existing);
          next.delete(selectedDay);
          return next;
        });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败，请稍后再试。");
    }
  }

  const sky = weather ? weatherMood(weather.code) : "clear";
  const todayLabel = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(today);
  const selectedDate = new Date(`${selectedDay}T12:00:00`);
  const selectedLabel = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(selectedDate);

  return (
    <main className="site-shell" data-period={period} data-weather={sky}>
      <div className="ambient-sky" aria-hidden="true">
        <div className="star-field">{stars.map(([x, y, delay], index) => <i key={index} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }} />)}</div>
        <div className="floating-charms"><span>✿</span><span>✦</span><span>♡</span><span>✧</span></div>
        <div className="sun-glow" />
        <div className="sky-cloud cloud-one" />
        <div className="sky-cloud cloud-two" />
        <svg className="rainbow-arc" viewBox="0 0 460 240" aria-hidden="true"><defs><linearGradient id="rainbow-colors" x1="30" y1="120" x2="430" y2="120" gradientUnits="userSpaceOnUse"><stop stopColor="#ef829b"/><stop offset=".2" stopColor="#f4a56f"/><stop offset=".4" stopColor="#f5d06f"/><stop offset=".6" stopColor="#7fc6a3"/><stop offset=".8" stopColor="#75bccc"/><stop offset="1" stopColor="#ac84d2"/></linearGradient></defs><path d="M30 220 A200 200 0 0 1 430 220" fill="none" stroke="url(#rainbow-colors)" strokeWidth="23" strokeLinecap="round"/></svg>
        {meteor > 0 && <div className="shooting-star" key={meteor} />}
        <div className="sky-grain" />
      </div>
      <div className="page-wrap">
        <header className="topbar">
          <a className="wordmark" href="#top"><span className="wordmark-flower">✿</span> 花开日记</a>
          <div className="top-links">
            <a href="#calendar">日历</a><a href="#journal">日记</a><a href="#send-flower">送花</a>
            {canEdit ? <><span className="owner-pill">站主已登录</span><button className="owner-logout" type="button" onClick={() => void logoutOwner()}>退出</button></> : <a className="owner-link" href="#owner-login">站主登录</a>}
          </div>
        </header>

        <section className="hero-grid" id="top">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> A LITTLE LIFE, DAY BY DAY</div>
            <h1>我的每一天<span className="title-period">。</span></h1>
            <p className="hero-lede">把心情、走过的日常和不经意的小事，慢慢写下来。</p>
            <div className="today-line"><span className="today-rule" />{todayLabel} · 慢慢来</div>
            <div className="weather-note" aria-live="polite">
              <span className="weather-icon">{weather ? (weather.code === 0 || weather.code === 1 ? "☀" : weather.code >= 51 ? "☂" : sky === "snow" ? "❄" : "☁") : "✧"}</span>
              <span><strong>北京 · {weather ? weatherLabel(weather.code) : "正在看一眼天气"}</strong><small>{weather?.temperature !== null && weather?.temperature !== undefined ? `${weather.temperature}°C · ` : ""}页面会跟着此刻的天色变化</small></span>
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">天气来源</a>
            </div>
          </div>

          <section className="calendar-card" id="calendar" aria-label="日历">
            <div className="calendar-topline"><div><div className="eyebrow">A SMALL MAP OF DAYS</div><h2>{month.getFullYear()}年{month.getMonth() + 1}月</h2></div><div className="month-controls"><button type="button" aria-label="上个月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><button type="button" aria-label="下个月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div></div>
            <div className="calendar-grid calendar-weekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid calendar-days">
              {calendarCells.map((day, index) => {
                if (!day) return <span className="day-blank" key={`blank-${index}`} />;
                const key = `${monthKey}-${String(day).padStart(2, "0")}`;
                const isToday = key === dateKey(today);
                const isSelected = key === selectedDay;
                return <button key={key} type="button" className={`day-cell${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}`} aria-label={`${month.getMonth() + 1}月${day}日${isToday ? "，今天" : ""}${markedDays.has(key) ? "，有日记" : ""}`} aria-current={isToday ? "date" : undefined} aria-pressed={isSelected} onClick={() => setSelectedDay(key)}><span>{day}</span>{markedDays.has(key) && <i className="day-mark" aria-hidden="true" />}</button>;
              })}
            </div>
            <div className="calendar-legend"><span><i className="legend-ring" />今天</span><span><i className="legend-dot" />有日记</span></div>
          </section>
        </section>

        <div className={`atmosphere-line ${rainbow ? "has-rainbow" : ""}`}>
          <span className="atmosphere-caption">{period === "morning" ? "早晨的光，刚好落在这里" : period === "day" ? "日光正好，给今天一点留白" : period === "evening" ? "傍晚把一天轻轻收好" : "夜色很安静，适合记下心事"}</span>
          <button type="button" className="sky-surprise" onClick={() => period === "night" ? setMeteor((value) => value + 1) : setRainbow((value) => !value)}>{period === "night" ? "✦ 看一颗流星" : rainbow ? "收起彩虹" : "给天空一点惊喜"}</button>
        </div>

        <section className="journal-section" id="journal">
          <div className="section-heading"><div><div className="eyebrow">NOTES FROM THE DAY</div><h2>{selectedDate.toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}<span> 的心情与日常</span></h2></div><div className="section-subtitle">不必按时刻排列，想到什么就记下来。</div></div>
          <div className="journal-layout">
            <div className="entry-list" aria-live="polite">
              {entries.length ? entries.map((entry) => <article className="entry-card" key={entry.id}><div className="entry-mark" aria-hidden="true">{moodMarks[entry.mood] ?? "✿"}</div><div className="entry-content"><div className="entry-meta"><span className="mood-chip">{entry.mood}</span>{entry.time && <time>{entry.time}</time>}</div><p>{entry.note}</p></div>{canEdit && <button className="delete-entry" type="button" aria-label="删除这条日记" onClick={() => void deleteEntry(entry.id)}>×</button>}</article>) : <div className="empty-journal"><span>✿</span><p>这一天还没有留下记录。</p><small>{canEdit ? "写下今天的心情，或记住做过的一件小事。" : "等一段日常慢慢长出来。"}</small></div>}
            </div>

            {canEdit ? <form className="editor-card" onSubmit={submitEntry}>
              <div className="editor-kicker"><span>站主编辑</span><small>保存后，访客就能看到</small></div>
              <label className="field-label" htmlFor="mood">今天的心情</label>
              <select id="mood" value={mood} onChange={(event) => setMood(event.target.value)}>{moods.map((item) => <option key={item}>{item}</option>)}</select>
              <label className="field-label" htmlFor="note">今天做了什么？</label>
              <textarea id="note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1200} placeholder="一顿好吃的饭、一段散步，或只是平凡的一天……" required />
              <div className="editor-bottom"><label className="optional-time" htmlFor="time">时间 <span>（可选）</span></label><input id="time" type="time" value={time} onChange={(event) => setTime(event.target.value)} /></div>
              <button className="save-button" type="submit" disabled={saving || !note.trim()}>{saving ? "正在保存…" : "保存这段日常　↗"}</button>
              {message && <p className="form-message" role="status">{message}</p>}
              <small className="privacy-note">公开日记会展示在此页面；只有站主登录后可以添加或删除。</small>
            </form> : <div className="visitor-panel"><aside className="visitor-note"><span className="visitor-flower">✿</span><p>日常由站主慢慢记录，<br />谢谢你来这里看看。</p>{message && <small role="status">{message}</small>}</aside><form className="login-card" id="owner-login" onSubmit={loginOwner}><div className="editor-kicker"><span>站主登录</span><small>登录后可编辑日记</small></div><label className="field-label" htmlFor="owner-username">用户名</label><input id="owner-username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /><label className="field-label" htmlFor="owner-password">密码</label><input id="owner-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button className="save-button" type="submit" disabled={authBusy}>{authBusy ? "正在登录…" : "登录　↗"}</button>{authMessage && <p className="auth-message" role="alert">{authMessage}</p>}</form></div>}
          </div>
        </section>

        <section className="small-plans" aria-label="日常小注"><article><span>01 / FEEL</span><h3>此刻的心情</h3><p>给感受一个温柔的位置</p></article><article><span>02 / NOTICE</span><h3>今天发生的事</h3><p>把细小的日常也认真收好</p></article><article><span>03 / TOMORROW</span><h3>留一点期待</h3><p>明天会有新的故事</p></article></section>

        <section className="gift-section" id="send-flower"><div className="eyebrow">A FLOWER FOR YOU</div><h2>路过的话，送我一朵花吧</h2><p>谢谢你把温柔留在这里。愿你今天也有好心情。</p><div className="gift-action"><button className="gift-button" type="button" onClick={() => { setFlowerCount((value) => value + 1); setFlowerBurst((value) => value + 1); }}>✿　送一朵花</button>{flowerBurst > 0 && <span className="petal-burst" key={flowerBurst} aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <i key={index} style={{ "--petal-index": index, "--fly-x": `${(index - 3) * 26}px`, "--fly-y": `${-48 + Math.abs(index - 3) * 9}px` } as React.CSSProperties}>✿</i>)}</span>}</div><div className="gift-response" aria-live="polite">{flowerCount ? `收到 ${flowerCount} 朵花，谢谢你的温柔！` : "点一下，让花开在今天。"}</div></section>

        <section className="flower-garden" aria-label="访客送来的花园"><div className="garden-heading"><span>VISITOR GARDEN</span><strong>{flowerCount ? `你们已经种下 ${flowerCount} 朵花` : "这里会长出访客送来的花"}</strong></div><div className="garden-bed" aria-live="polite">{Array.from({ length: Math.min(flowerCount, 40) }, (_, index) => <div className="garden-flower" key={index} style={{ "--flower-index": index, "--grow-delay": `${Math.min(index, 8) * 55}ms` } as React.CSSProperties} aria-label={`第 ${index + 1} 朵花`}><span className="bloom">✿</span><i className="stem"/><i className="leaf leaf-left"/><i className="leaf leaf-right"/></div>)}<span className="garden-ground"/></div></section>

        <footer className="footer"><span>MY DAYS, IN BLOOM</span><span>天气由 <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> 提供　·　慢慢生活，也好好生活。</span></footer>
      </div>
    </main>
  );
}
