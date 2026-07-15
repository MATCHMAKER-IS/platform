"use client";
/** 日付ユーティリティのデモ: ミニカレンダー・和暦・年齢・相対表記・営業日。 */
import { useState } from "react";
import { MiniCalendar, DateRangePicker, CalendarHeatmap, type PickedRange } from "@platform/ui";
import { formatWareki, age, formatRelativeDay, holidayName, isBusinessDay, addBusinessDays, daysUntil, formatDate, businessMinutesBetween, formatDuration, rangeDays } from "@platform/datetime";

const NOW = new Date();

export default function Page() {
  const [selected, setSelected] = useState<Date>(NOW);
  const [range, setRange] = useState<PickedRange | null>(null);
  const counts: Record<string, number> = { [formatDate(NOW)]: 5, [formatDate(new Date(NOW.getTime() - 86400000))]: 2, [formatDate(new Date(NOW.getTime() - 3 * 86400000))]: 9 };
  return (
    <main style={{ maxWidth: 720, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>日付ユーティリティ</h1>

      <section style={{ display: "flex", gap: "2rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <MiniCalendar navigable selected={selected} onSelect={setSelected} />
        <div style={{ fontSize: ".95rem", lineHeight: 2 }}>
          <div>選択日: <b>{formatDate(selected)}</b>({formatWareki(selected)})</div>
          <div>相対: {formatRelativeDay(selected, NOW)}</div>
          <div>祝日: {holidayName(selected) ?? "—"}</div>
          <div>営業日: {isBusinessDay(selected) ? "はい" : "いいえ"}</div>
          <div>次の営業日: {formatDate(addBusinessDays(selected, 1))}</div>
        </div>
      </section>

      <section style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>年齢・カウントダウン</h2>
        <ul style={{ fontSize: ".95rem", lineHeight: 1.9 }}>
          <li>1990-06-15 生まれの年齢: {age(new Date("1990-06-15T00:00:00Z"), NOW)}歳</li>
          <li>2000-02-29 生まれの年齢: {age(new Date("2000-02-29T00:00:00Z"), NOW)}歳</li>
          <li>2027-01-01 まで: あと {daysUntil(new Date("2027-01-01T00:00:00Z"), NOW)} 日</li>
        </ul>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>期間選択</h2>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
          <DateRangePicker value={range ?? undefined} onChange={setRange} />
          <div style={{ fontSize: ".95rem", lineHeight: 2 }}>
            {range?.end ? <>選択期間: {formatDate(range.start)} 〜 {formatDate(range.end)}(<b>{rangeDays({ start: range.start, end: range.end })}</b>日間)</> : "開始日と終了日をクリック"}
          </div>
        </div>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>件数ヒートマップ(直近8週)</h2>
        <CalendarHeatmap counts={counts} start={new Date(NOW.getTime() - 55 * 86400000)} end={NOW} />
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>営業時間・所要時間</h2>
        <ul style={{ fontSize: ".95rem", lineHeight: 1.9 }}>
          <li>木10:00〜金15:00 の営業時間(9-18): {formatDuration(businessMinutesBetween(new Date("2024-01-04T10:00:00Z"), new Date("2024-01-05T15:00:00Z")) * 60)}</li>
          <li>所要時間整形: {formatDuration(9000)} / {formatDuration(90061, { maxUnits: 3 })}</li>
        </ul>
      </section>

      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
