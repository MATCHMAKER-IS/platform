"use client";
/**
 * 日付ユーティリティのデモ。@platform/datetime の関数を実際に呼んでいる。
 *
 * 業務でよく出る「和暦」「年齢」「営業日」「祝日」「締め日」を、
 * その場で値を入れて確かめられるようにしている。
 */
import * as React from "react";
import { MiniCalendar, DateRangePicker, CalendarHeatmap, Input, Select, Badge, type PickedRange } from "@platform/ui";
import {
  formatWareki, age, formatRelativeDay, holidayName, holidaysInYear, isBusinessDay, addBusinessDays,
  businessDaysBetween, daysUntil, formatDate, businessMinutesBetween, formatDuration, rangeDays,
  endOfMonth, weekdayNameJa, quarter, isWeekend,
} from "@platform/datetime";

const NOW = new Date();
const h2: React.CSSProperties = { fontWeight: 700, marginBottom: 8, fontSize: "1rem" };
const sec: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const lb: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" };
const li: React.CSSProperties = { fontSize: 13.5, lineHeight: 2 };

/** 月末を過ぎない範囲で「月末から数えた最終営業日」を求める（締め日の計算）。 */
function lastBusinessDayOfMonth(d: Date): Date {
  let x = endOfMonth(d);
  while (!isBusinessDay(x)) x = new Date(x.getFullYear(), x.getMonth(), x.getDate() - 1);
  return x;
}

export default function Page() {
  const [selected, setSelected] = React.useState<Date>(NOW);
  const [range, setRange] = React.useState<PickedRange | null>(null);
  const [birth, setBirth] = React.useState("1990-06-15");
  const [bizDays, setBizDays] = React.useState(5);
  const [year, setYear] = React.useState(String(NOW.getFullYear()));

  const counts: Record<string, number> = {
    [formatDate(NOW)]: 5,
    [formatDate(new Date(NOW.getTime() - 86400000))]: 2,
    [formatDate(new Date(NOW.getTime() - 3 * 86400000))]: 9,
  };

  const birthDate = React.useMemo(() => {
    const d = new Date(`${birth}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [birth]);

  const holidays = React.useMemo(() => {
    const y = Number(year);
    return Number.isFinite(y) && y > 1948 ? holidaysInYear(y) : [];
  }, [year]);

  const target = addBusinessDays(selected, bizDays);
  const closing = lastBusinessDayOfMonth(selected);

  return (
    <main style={{ maxWidth: 820, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>日付ユーティリティ</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        和暦・年齢・営業日・祝日・締め日など、日本の業務でつまずきやすい日付計算を <code>@platform/datetime</code> で行っています。値を変えて確かめられます。
      </p>

      <section style={sec}>
        <div style={h2}>日付を選ぶ</div>
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          <MiniCalendar navigable selected={selected} onSelect={setSelected} />
          <div style={li}>
            <div>選択日: <b>{formatDate(selected)}</b>（{weekdayNameJa(selected)}曜日）</div>
            <div>和暦: {formatWareki(selected)}</div>
            <div>相対: {formatRelativeDay(selected, NOW)}</div>
            <div>祝日: {holidayName(selected) ?? "—"}</div>
            <div>
              区分: {isBusinessDay(selected)
                ? <Badge variant="success">営業日</Badge>
                : <Badge variant="danger">{isWeekend(selected) ? "休日（土日）" : "祝日"}</Badge>}
            </div>
            <div>四半期: 第{quarter(selected)}四半期</div>
          </div>
        </div>
      </section>

      <section style={sec}>
        <div style={h2}>営業日の計算</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
          <label style={lb}>選択日から何営業日後
            <Input type="number" value={bizDays} min={-60} max={60} onChange={(e) => setBizDays(Number(e.target.value) || 0)} style={{ width: 100 }} />
          </label>
        </div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li style={li}>{formatDate(selected)} の <b>{bizDays}</b> 営業日後 → <b>{formatDate(target)}</b>（{weekdayNameJa(target)}）</li>
          <li style={li}>今月の締め日（最終営業日）→ <b>{formatDate(closing)}</b>（{weekdayNameJa(closing)}）</li>
          <li style={li}>今日から選択日までの営業日数: <b>{businessDaysBetween(NOW, selected)}</b> 日</li>
        </ul>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.8 }}>
          土日と祝日（振替休日を含む）を除いて数えます。支払期日や納期の算出で、単純な日数計算と結果が変わる部分です。
        </p>
      </section>

      <section style={sec}>
        <div style={h2}>年齢・カウントダウン</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
          <label style={lb}>生年月日
            <Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
          </label>
        </div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li style={li}>年齢: <b>{birthDate ? `${age(birthDate, NOW)} 歳` : "日付を確認してください"}</b>{birthDate && <>（{formatWareki(birthDate)} 生まれ）</>}</li>
          <li style={li}>2000-02-29 生まれの年齢: {age(new Date("2000-02-29T00:00:00"), NOW)} 歳（うるう日も正しく数えます）</li>
          <li style={li}>選択日まで: あと {daysUntil(selected, NOW)} 日</li>
        </ul>
      </section>

      <section style={sec}>
        <div style={h2}>期間の選択</div>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
          <DateRangePicker value={range ?? undefined} onChange={setRange} />
          <div style={li}>
            {range?.end ? (
              <>
                <div>期間: {formatDate(range.start)} 〜 {formatDate(range.end)}</div>
                <div>日数: <b>{rangeDays({ start: range.start, end: range.end })}</b> 日</div>
                <div>うち営業日: <b>{businessDaysBetween(range.start, range.end)}</b> 日</div>
              </>
            ) : "開始日と終了日をクリックしてください"}
          </div>
        </div>
      </section>

      <section style={sec}>
        <div style={h2}>祝日一覧</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
          <label style={lb}>年
            <Select value={year} onChange={(e) => setYear(e.target.value)}
              options={[-1, 0, 1, 2].map((d) => { const y = String(NOW.getFullYear() + d); return { label: `${y} 年`, value: y }; })} />
          </label>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{holidays.length} 日</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 6 }}>
          {holidays.map((h) => (
            <div key={h.name + formatDate(h.date)} style={{ fontSize: 12.5, padding: "6px 10px", borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
              <b>{formatDate(h.date)}</b>（{weekdayNameJa(h.date)}）{h.name}
            </div>
          ))}
        </div>
      </section>

      <section style={sec}>
        <div style={h2}>件数ヒートマップ（直近8週）</div>
        <CalendarHeatmap counts={counts} start={new Date(NOW.getTime() - 55 * 86400000)} end={NOW} />
      </section>

      <section style={sec}>
        <div style={h2}>営業時間・所要時間</div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li style={li}>木10:00〜金15:00 を営業時間(9-18)で数える: {formatDuration(businessMinutesBetween(new Date("2024-01-04T10:00:00"), new Date("2024-01-05T15:00:00")) * 60)}</li>
          <li style={li}>所要時間の整形: {formatDuration(9000)} / {formatDuration(90061, { maxUnits: 3 })}</li>
        </ul>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.8 }}>
          問い合わせの「営業時間内での経過時間」など、SLA の計測に使います。
        </p>
      </section>
    </main>
  );
}
