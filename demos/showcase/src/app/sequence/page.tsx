"use client";
/** 採番のデモ: 接頭辞・ゼロ埋め・期間リセット（年度/年/月）・原子的な発番。 */
import * as React from "react";
import { createSequencer, createMemorySequenceStore, periodToken, type ResetPeriod } from "@platform/sequence";

const RESETS: { value: ResetPeriod; label: string; hint: string }[] = [
  { value: "never", label: "リセットしない", hint: "通し番号。増え続ける" },
  { value: "yearly", label: "年（1月始まり）", hint: "暦年で 1 に戻る" },
  { value: "fiscalYearly", label: "年度（4月始まり）", hint: "日本の会計年度で 1 に戻る" },
  { value: "monthly", label: "月", hint: "毎月 1 に戻る" },
];

const store = createMemorySequenceStore();

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

export default function Page() {
  const [prefix, setPrefix] = React.useState("INV");
  const [padding, setPadding] = React.useState(4);
  const [resetPeriod, setResetPeriod] = React.useState<ResetPeriod>("fiscalYearly");
  const [separator, setSeparator] = React.useState("-");
  const [dateStr, setDateStr] = React.useState("2026-07-17");
  const [issued, setIssued] = React.useState<{ no: string; at: string }[]>([]);

  const date = React.useMemo(() => {
    const d = new Date(`${dateStr}T00:00:00`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [dateStr]);

  const seq = React.useMemo(
    () => createSequencer(store, "demo-invoice", { prefix, padding, resetPeriod, separator, fiscalStartMonth: 4 }),
    [prefix, padding, resetPeriod, separator],
  );

  const key = seq.keyFor(date);
  const token = periodToken(resetPeriod, date, 4);

  async function issue() {
    const no = await seq.next(date);
    setIssued((prev) => [{ no, at: dateStr }, ...prev].slice(0, 12));
  }

  function reset() {
    store.reset();
    setIssued([]);
  }

  return (
    <main style={{ maxWidth: 860, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>採番（伝票番号）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        請求書番号や申請番号のような「連番」を発行します。地味ですが、
        <strong>アプリごとに自作すると必ず事故ります</strong>（二重発番・年度またぎのリセット漏れ・桁溢れ）。
        <code>@platform/sequence</code> は<strong>年度で 1 に戻す</strong>といった日本の実務を持っています。
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>接頭辞</div>
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} style={{ ...field, width: 80 }} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>区切り</div>
            <input value={separator} onChange={(e) => setSeparator(e.target.value)} style={{ ...field, width: 60 }} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>ゼロ埋め桁数</div>
            <input
              type="number"
              min={0}
              max={10}
              value={padding}
              onChange={(e) => setPadding(Number(e.target.value))}
              style={{ ...field, width: 70, textAlign: "right" }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>リセット周期</div>
            <select value={resetPeriod} onChange={(e) => setResetPeriod(e.target.value as ResetPeriod)} style={{ ...field, width: 170 }}>
              {RESETS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>発番日（変えられます）</div>
            <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} style={{ ...field, width: 150 }} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            onClick={issue}
            style={{ padding: "8px 18px", borderRadius: "var(--radius)", border: "none", background: "var(--color-primary)", color: "var(--color-primary-fg)", cursor: "pointer" }}
          >
            発番する
          </button>
          <button
            onClick={reset}
            style={{ padding: "8px 18px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", cursor: "pointer" }}
          >
            カウンタをクリア
          </button>
        </div>

        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 12, lineHeight: 1.8 }}>
          {RESETS.find((r) => r.value === resetPeriod)?.hint}
          <br />
          カウンタキー: <code>{key}</code>
          {token !== "" && (
            <>
              {" "}
              / 期間トークン: <code>{token}</code>
            </>
          )}
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>発番した番号</h2>
        {issued.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-muted)" }}>「発番する」を押してください</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {issued.map((it, i) => (
              <span
                key={`${it.no}-${i}`}
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  padding: "4px 10px",
                  borderRadius: 4,
                  border: "1px solid var(--color-border)",
                  background: i === 0 ? "var(--color-primary)" : "var(--color-bg)",
                  color: i === 0 ? "var(--color-primary-fg)" : "var(--color-fg)",
                }}
              >
                {it.no}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>年度リセットを確かめる</h2>
        <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.9, margin: 0 }}>
          リセット周期を<b>「年度（4月始まり）」</b>にして、次の順で試してください。
        </p>
        <ol style={{ fontSize: 13, lineHeight: 1.9, color: "var(--color-muted)", paddingLeft: "1.3em", marginTop: 6, marginBottom: 0 }}>
          <li>発番日 <code>2026-03-31</code> で何回か発番 → 2025 年度の連番</li>
          <li>発番日 <code>2026-04-01</code> に変えて発番 → <b>1 に戻る</b>（年度が変わったため）</li>
          <li>発番日を <code>2026-03-31</code> へ戻して発番 → <b>前の続きから</b>（年度ごとに別カウンタ）</li>
        </ol>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10 }}>
          「年」を選ぶと 1 月始まりになり、同じ操作でも結果が変わります。
          この判定を各アプリで書くと、必ずどこかが間違います。
        </p>
      </div>
    </main>
  );
}
