"use client";
/** 利用分析のデモ: PV・UU・人気ページ・参照元・時系列・直帰率。 */
import * as React from "react";
import { DatePicker, Select } from "@platform/ui";
import {
  // pageViews / uniqueVisitors / uniqueUsers / bounceRate は summarize() の戻り値で足りる。
  // 個別に呼ぶ必要があるとき(期間を分けて比較する等)のために基盤には残っている。
  topPages,
  referrerBreakdown,
  timeSeries,
  summarize,
  withinPeriod,
  ofType,
  type AnalyticsEvent,
  type Bucket,
} from "@platform/analytics";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

/** 社内ポータルのアクセス(モック)。3日分・複数セッション。 */
const EVENTS: AnalyticsEvent[] = (() => {
  const out: AnalyticsEvent[] = [];
  const paths = ["/", "/expenses", "/attendance", "/faq", "/inquiries", "/"];
  const refs = ["", "https://intra.example.co.jp/", "https://www.google.com/", "https://teams.microsoft.com/"];
  let n = 0;
  for (let day = 16; day <= 18; day += 1) {
    for (let s = 0; s < 8; s += 1) {
      const sessionId = `s-${day}-${s}`;
      const userId = s % 3 === 0 ? undefined : `u-${(s % 5) + 1}`;
      // 1 セッションあたり 1〜4 ページ。1 ページで終わるのが直帰。
      const depth = (s % 4) + 1;
      for (let i = 0; i < depth; i += 1) {
        const hour = 9 + ((s + i) % 9);
        out.push({
          type: "pageview",
          path: paths[(s + i) % paths.length] ?? "/",
          sessionId,
          ...(userId !== undefined ? { userId } : {}),
          at: `2026-07-${day}T${String(hour).padStart(2, "0")}:${String((n * 7) % 60).padStart(2, "0")}:00Z`,
          ...(i === 0 ? { referrer: refs[s % refs.length] ?? "" } : {}),
        });
        n += 1;
      }
      // 経費申請ページでのクリック(pageview 以外も混ぜる)
      if (s % 3 === 0) {
        out.push({ type: "click", path: "/expenses", sessionId, at: `2026-07-${day}T10:30:00Z`, name: "submit" });
      }
    }
  }
  return out;
})();

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function AnalyticsDemo() {
  const [from, setFrom] = React.useState("2026-07-16");
  const [to, setTo] = React.useState("2026-07-18");
  const [bucket, setBucket] = React.useState<Bucket>("day");

  const filtered = React.useMemo(() => withinPeriod(EVENTS, from, to), [from, to]);
  const views = React.useMemo(() => ofType(filtered, "pageview"), [filtered]);
  const clicks = React.useMemo(() => ofType(filtered, "click"), [filtered]);
  const sum = React.useMemo(() => summarize(filtered, { topN: 5 }), [filtered]);
  const series = React.useMemo(() => timeSeries(filtered, bucket), [filtered, bucket]);
  const refs = React.useMemo(() => referrerBreakdown(filtered, 5), [filtered]);
  const pages = React.useMemo(() => topPages(filtered, 5), [filtered]);

  const maxCount = Math.max(...series.map((s) => s.views), 1);
  const maxPage = Math.max(...pages.map((p) => p.views), 1);

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>利用分析</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        社内ポータルのアクセスを集計します。<strong>外部の解析サービスに社員の行動を送らずに済む</strong>のが、
        基盤に持つ理由です。個人情報を計測基盤へ流さないための<strong>設計上の制約</strong>も入っています（下記）。
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-muted)" }}>
            期間
            <DatePicker value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 150 }} />
          </label>
          <span style={{ color: "var(--color-muted)" }}>〜</span>
          <DatePicker value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 150 }} />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-muted)", marginLeft: "auto" }}>
            粒度
            <Select
              value={bucket}
              onChange={(e) => setBucket(e.target.value === "hour" ? "hour" : "day")}
              options={[{ label: "日", value: "day" }, { label: "時間", value: "hour" }]}
              style={{ width: 90 }}
            />
          </label>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8 }}>
          全 {EVENTS.length} 件中 <b>{filtered.length}</b> 件（pageview {views.length} / click {clicks.length}）
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: "ページビュー", value: String(sum.pageViews), note: "pageview の総数" },
          { label: "訪問者", value: String(sum.uniqueVisitors), note: "セッションのユニーク" },
          { label: "ログイン利用者", value: String(sum.uniqueUsers), note: "userId のユニーク" },
          { label: "直帰率", value: pct(sum.bounceRate), note: "1 ページで離脱" },
        ].map((s) => (
          <div key={s.label} style={{ ...box, marginBottom: 0, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "var(--color-muted)" }}>{s.note}</div>
          </div>
        ))}
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>推移</h2>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 140 }}>
          {series.map((p) => (
            <div key={p.bucket} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 10, color: "var(--color-muted)" }}>{p.views}</div>
              <div
                title={`${p.bucket} — PV ${p.views} / 訪問者 ${p.visitors}`}
                style={{
                  width: "100%",
                  height: `${(p.views / maxCount) * 100}%`,
                  minHeight: 2,
                  background: "var(--color-primary)",
                  borderRadius: "2px 2px 0 0",
                }}
              />
              <div style={{ fontSize: 9, color: "var(--color-muted)", writingMode: bucket === "hour" ? "vertical-rl" : undefined }}>
                {bucket === "day" ? p.bucket.slice(5) : p.bucket.slice(11)}
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10 }}>
          粒度を「時間」にすると、<strong>社内システムらしい山</strong>が出ます（始業直後と昼休み明け）。
          社外向けサイトとは形が違うので、そのまま外部サービスの常識を当てはめると読み違えます。
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div style={box}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>人気ページ</h2>
          {pages.map((p) => (
            <div key={p.path} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                <span style={{ fontFamily: "monospace" }}>{p.path}</span>
                <span>
                  <b>{p.views}</b>
                  <span style={{ color: "var(--color-muted)", marginLeft: 6 }}>／{p.visitors}人</span>
                </span>
              </div>
              <div style={{ height: 6, background: "var(--color-bg)", borderRadius: 3 }}>
                <div style={{ height: 6, width: `${(p.views / maxPage) * 100}%`, background: "var(--color-primary)", borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>

        <div style={box}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>参照元</h2>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <tbody>
              {refs.map((r) => (
                <tr key={r.referrer} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 5 }}>{r.referrer === "direct" ? "（直接アクセス）" : r.referrer}</td>
                  <td style={{ padding: 5, textAlign: "right", fontWeight: 700 }}>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 8 }}>
            社内ポータルは<strong>「直接アクセス」と Teams が大半</strong>になります。
          </p>
        </div>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>個人情報を送らないための制約</h2>
        <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.9, margin: 0 }}>
          <code>@platform/analytics</code> の TSDoc にはこう書いてあります —
          <strong>「個人を特定する情報を入れないこと。パスにユーザー ID や検索語が入ると、
          意図せず個人情報を計測基盤に送ることになる」</strong>。
        </p>
        <ul style={{ fontSize: 13, lineHeight: 1.9, color: "var(--color-muted)", paddingLeft: "1.2em", marginTop: 8, marginBottom: 0 }}>
          <li>
            <code>/users/12345</code> のようなパスをそのまま送ると、<strong>誰が誰を見たかが残ります</strong>。
            送る前に <code>/users/:id</code> へ畳んでください
          </li>
          <li>
            検索語をクエリに含めると、<strong>社員が何を調べたかが蓄積されます</strong>
          </li>
          <li>
            <code>userId</code> は任意です。<strong>入れなければ「訪問者数」だけが分かり、個人は追えません</strong>。
            上の「ログイン利用者」が「訪問者」より少ないのは、userId を持たないセッションがあるためです
          </li>
        </ul>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10 }}>
          個人を特定する必要があるなら <code>/pii</code> のマスキングと組み合わせます。
          外部の解析サービスに送らずに済むのが、これを基盤に持つ理由です。
        </p>
      </div>
    </>
  );
}
