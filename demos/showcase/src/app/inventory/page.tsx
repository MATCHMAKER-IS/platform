"use client";
/** 在庫のデモ: 入出庫の履歴から現在庫を導出・発注点・発注量。 */
import * as React from "react";
import {
  onHand,
  summarize,
  applyMovement,
  reorderPoint,
  needsReorder,
  reorderQuantity,
  type StockMovement,
  type MovementType,
  type ReorderPolicy,
} from "@platform/inventory";

const TYPE_LABEL: Record<MovementType, string> = {
  inbound: "入庫",
  outbound: "出庫",
  adjustment: "調整",
};

const TYPE_COLOR: Record<MovementType, string> = {
  inbound: "var(--color-success)",
  outbound: "var(--color-primary)",
  adjustment: "var(--color-warning)",
};

const INITIAL: StockMovement[] = [
  { type: "inbound", quantity: 100, at: "2026-07-01", ref: "PO-2026-0001" },
  { type: "outbound", quantity: 30, at: "2026-07-05", ref: "SO-1201" },
  { type: "outbound", quantity: 25, at: "2026-07-09", ref: "SO-1215" },
  { type: "adjustment", quantity: -2, at: "2026-07-10", ref: "棚卸差異" },
  { type: "outbound", quantity: 18, at: "2026-07-14", ref: "SO-1233" },
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

export default function Page() {
  const [movements, setMovements] = React.useState<StockMovement[]>(INITIAL);
  const [type, setType] = React.useState<MovementType>("outbound");
  const [qty, setQty] = React.useState(10);
  const [rejected, setRejected] = React.useState<string>("");

  const [safetyStock, setSafetyStock] = React.useState(20);
  const [dailyDemand, setDailyDemand] = React.useState(5);
  const [leadTimeDays, setLeadTimeDays] = React.useState(7);

  const policy: ReorderPolicy = { safetyStock, dailyDemand, leadTimeDays };
  const current = onHand(movements);
  const stats = summarize(movements);
  const point = reorderPoint(policy);
  const alert = needsReorder(current, policy);
  const orderQty = reorderQuantity(current, policy);

  function add() {
    setRejected("");
    const r = applyMovement(movements, { type, quantity: qty, at: "2026-07-17", ref: "手入力" });
    if (r.ok) setMovements(r.movements);
    else setRejected(`受け付けられません（${TYPE_LABEL[type]} ${qty}）`);
  }

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>在庫</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <strong>現在庫は「数値」として持たず、入出庫の履歴から毎回導出します。</strong>
        こうすると「なぜこの数なのか」が必ず説明でき、棚卸差異も履歴の 1 行として残ります。
        在庫数を直接 UPDATE する作りだと、ズレたときに追跡できません。
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: "現在庫", value: current, color: alert ? "var(--color-danger)" : "var(--color-fg)" },
          { label: "累計入庫", value: stats.totalIn, color: "var(--color-success)" },
          { label: "累計出庫", value: stats.totalOut, color: "var(--color-primary)" },
          { label: "調整", value: stats.adjustments, color: "var(--color-warning)" },
        ].map((s) => (
          <div key={s.label} style={{ ...box, marginBottom: 0, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>① 発注点</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>安全在庫</div>
            <input type="number" value={safetyStock} onChange={(e) => setSafetyStock(Number(e.target.value))} style={{ ...field, width: 80, textAlign: "right" }} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>1日あたり需要</div>
            <input type="number" value={dailyDemand} onChange={(e) => setDailyDemand(Number(e.target.value))} style={{ ...field, width: 80, textAlign: "right" }} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>調達リードタイム（日）</div>
            <input type="number" value={leadTimeDays} onChange={(e) => setLeadTimeDays(Number(e.target.value))} style={{ ...field, width: 80, textAlign: "right" }} />
          </label>
        </div>

        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--radius)",
            fontSize: 13,
            fontWeight: 700,
            color: alert ? "var(--color-danger)" : "var(--color-success)",
            border: `1px solid ${alert ? "var(--color-danger)" : "var(--color-success)"}`,
          }}
        >
          発注点 <b>{point}</b> / 現在庫 <b>{current}</b> —{" "}
          {alert ? `発注が必要です（推奨 ${orderQty} 個）` : "まだ大丈夫です"}
        </div>

        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          発注点 = 安全在庫 + 1日あたり需要 × リードタイム = {safetyStock} + {dailyDemand} × {leadTimeDays} = <b>{point}</b>
          <br />
          「届くまでの間に売れる分」を切らさないための数です。出庫を積むか、リードタイムを伸ばすと赤くなります。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>② 入出庫を記録</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={type} onChange={(e) => setType(e.target.value as MovementType)} style={{ ...field, width: 110 }}>
            {(Object.keys(TYPE_LABEL) as MovementType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} style={{ ...field, width: 90, textAlign: "right" }} />
          <button
            onClick={add}
            style={{ padding: "7px 18px", borderRadius: "var(--radius)", border: "none", background: "var(--color-primary)", color: "var(--color-primary-fg)", cursor: "pointer" }}
          >
            記録する
          </button>
          <button
            onClick={() => {
              setMovements(INITIAL);
              setRejected("");
            }}
            style={{ padding: "7px 18px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", cursor: "pointer" }}
          >
            戻す
          </button>
        </div>
        {rejected !== "" && <p style={{ fontSize: 13, color: "var(--color-danger)", marginTop: 10, fontWeight: 700 }}>× {rejected}</p>}
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <code>applyMovement()</code> は <code>{"{ ok, movements }"}</code> を返します。
          <strong>在庫より多い出庫は拒否されます</strong>（現在庫 {current} より大きい出庫を試してください）。
          「調整」は棚卸差異用なのでマイナスも入ります。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>③ 履歴（{movements.length} 件）</h2>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 5 }}>日付</th>
              <th style={{ padding: 5 }}>種別</th>
              <th style={{ padding: 5, textAlign: "right" }}>数量</th>
              <th style={{ padding: 5, textAlign: "right" }}>残</th>
              <th style={{ padding: 5 }}>参照</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5 }}>{m.at}</td>
                <td style={{ padding: 5, color: TYPE_COLOR[m.type], fontWeight: 700 }}>{TYPE_LABEL[m.type]}</td>
                <td style={{ padding: 5, textAlign: "right" }}>{m.quantity}</td>
                <td style={{ padding: 5, textAlign: "right", color: "var(--color-muted)" }}>{onHand(movements.slice(0, i + 1))}</td>
                <td style={{ padding: 5, color: "var(--color-muted)" }}>{m.ref ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10 }}>
          「残」の列は、その時点までの履歴を <code>onHand()</code> に渡して計算しています。
          <strong>どの行の数字も、履歴から再計算できます。</strong>
          <code>PO-2026-0001</code> は <code>/purchase</code> の発注書で、そのまま繋がります。
        </p>
      </div>
    </main>
  );
}
