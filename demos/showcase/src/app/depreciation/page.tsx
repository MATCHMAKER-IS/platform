"use client";
/** 減価償却のデモ: 定額法 / 定率法のスケジュール生成・償却率・備忘価額。 */
import * as React from "react";
import {
  depreciationSchedule,
  bookValueAt,
  straightLineRate,
  decliningBalanceRate,
  MEMORANDUM_VALUE,
  type DepreciableAsset,
  type DepreciationMethod,
} from "@platform/depreciation";

const PRESETS: { label: string; cost: number; life: number }[] = [
  { label: "ノート PC（4年）", cost: 240000, life: 4 },
  { label: "社用車（6年）", cost: 3200000, life: 6 },
  { label: "サーバ（5年）", cost: 1200000, life: 5 },
  { label: "複合機（5年）", cost: 850000, life: 5 },
];

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const field: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-fg)",
  fontSize: 13,
};

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;

export default function Page() {
  const [cost, setCost] = React.useState(1200000);
  const [life, setLife] = React.useState(5);
  const [method, setMethod] = React.useState<DepreciationMethod>("declining_balance");
  const [startYear, setStartYear] = React.useState(2026);

  const asset: DepreciableAsset = React.useMemo(() => ({ cost, usefulLifeYears: life, method }), [cost, life, method]);
  const schedule = React.useMemo(() => depreciationSchedule(asset, startYear), [asset, startYear]);

  const rate = method === "straight_line" ? straightLineRate(life) : decliningBalanceRate(life);
  const maxDep = Math.max(...schedule.map((s) => s.depreciation), 1);

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>減価償却</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        固定資産の償却スケジュールを、<strong>定額法</strong>と<strong>定率法</strong>で生成します。
        最終年度に <strong>備忘価額 {MEMORANDUM_VALUE} 円</strong>を残して償却しきる、といった実務上の細かい決まりも
        <code>@platform/depreciation</code> が持ちます。会計ソフトへ渡す前の試算や、稟議の資料に使えます。
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>取得価額</div>
            <input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} style={{ ...field, width: 130, textAlign: "right" }} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>耐用年数</div>
            <input type="number" value={life} min={1} max={50} onChange={(e) => setLife(Math.max(1, Number(e.target.value)))} style={{ ...field, width: 70, textAlign: "right" }} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>取得年度</div>
            <input type="number" value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} style={{ ...field, width: 90, textAlign: "right" }} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>償却方法</div>
            <select value={method} onChange={(e) => setMethod(e.target.value === "straight_line" ? "straight_line" : "declining_balance")} style={{ ...field, width: 130 }}>
              <option value="straight_line">定額法</option>
              <option value="declining_balance">定率法</option>
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setCost(p.cost);
                setLife(p.life);
              }}
              style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-muted)", cursor: "pointer" }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 12 }}>
          償却率 <b style={{ color: "var(--color-fg)" }}>{(rate * 100).toFixed(1)}%</b>
          {method === "declining_balance" ? "（定率法・200% 定率＝2 ÷ 耐用年数）" : "（定額法＝1 ÷ 耐用年数）"}
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>償却スケジュール</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "right", color: "var(--color-muted)" }}>
              <th style={{ padding: 6, textAlign: "left" }}>年度</th>
              <th style={{ padding: 6 }}>償却額</th>
              <th style={{ padding: 6 }}>償却累計</th>
              <th style={{ padding: 6 }}>期末簿価</th>
              <th style={{ padding: 6, width: "35%", textAlign: "left" }}>償却額の推移</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((s) => (
              <tr key={s.year} style={{ borderTop: "1px solid var(--color-border)", textAlign: "right" }}>
                <td style={{ padding: 6, textAlign: "left" }}>{s.year}</td>
                <td style={{ padding: 6 }}>{yen(s.depreciation)}</td>
                <td style={{ padding: 6, color: "var(--color-muted)" }}>{yen(s.accumulated)}</td>
                <td style={{ padding: 6, fontWeight: 700 }}>{yen(s.bookValue)}</td>
                <td style={{ padding: 6 }}>
                  <div
                    style={{
                      height: 10,
                      width: `${(s.depreciation / maxDep) * 100}%`,
                      background: "var(--color-primary)",
                      borderRadius: 2,
                      minWidth: 2,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          定率法は初年度に大きく償却し、後半ほど小さくなります（棒の長さで分かります）。
          最終年度の簿価が <b>{yen(MEMORANDUM_VALUE)}</b> で止まるのが備忘価額です。ゼロにはしません。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>特定年度の簿価</h2>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13 }}>
          {[0, 1, 2].map((offset) => {
            const y = startYear + offset;
            return (
              <span key={y}>
                {y} 年度末 <b>{yen(bookValueAt(schedule, y, cost))}</b>
              </span>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8 }}>
          <code>bookValueAt()</code> は取得前なら取得価額、償却後なら最終簿価を返します（範囲外でも壊れません）。
        </p>
      </div>
    </main>
  );
}
