"use client";
/**
 * 口座残高の画面。
 *
 * **資金繰りで最初に見たいのは「いくらあるか」ではなく「いつ足りなくなるか」**です。
 * そのため、最新の残高だけでなく **最小とその日** を目立たせています。
 */
import * as React from "react";
// **SimpleStatCard を使う。** @platform/ui には StatCard が 2 つあり、
// 主(dashboard.tsx)は delta / trend / format を持つが **hint は無い**。
// ここは「単位を添えるだけ」なので、hint を持つ SimpleStatCard(stat-card.tsx)が合う。
import { LineChart, BarChart, Badge, Alert, Select, SimpleStatCard, DashboardGrid, DashboardWidget } from "@platform/ui";
import type { BalanceView } from "../server/balance-service";

const yen = (n: number) => `${n.toLocaleString()} 円`;

/** 口座の種類の呼び名。 */
const TYPE_LABEL: Record<string, string> = {
  bank_account: "銀行",
  credit_card: "カード",
  wallet: "現金",
};

export function BalanceClient({ view }: { view: BalanceView }) {
  const [walletId, setWalletId] = React.useState("all");

  // 表示する系列。「すべて」なら合算、個別ならその口座
  const points = React.useMemo(() => {
    if (walletId === "all") return view.total;
    return view.histories.find((h) => String(h.walletableId) === walletId)?.points ?? [];
  }, [walletId, view]);

  // グラフは日数が多いと潰れるので、週ごとにまとめる
  const chartData = React.useMemo(
    () => points.filter((_, i) => i % 7 === 0 || i === points.length - 1)
      .map((p) => ({ date: p.date.slice(5), 残高: p.balance })),
    [points],
  );

  // 入出金は日ごとだと細かすぎる。月でまとめる
  const monthly = React.useMemo(() => {
    const m = new Map<string, { 入金: number; 出金: number }>();
    for (const p of points) {
      const key = p.date.slice(0, 7);
      const cur = m.get(key) ?? { 入金: 0, 出金: 0 };
      cur.入金 += p.income;
      cur.出金 += p.expense;
      m.set(key, cur);
    }
    return [...m.entries()].map(([month, v]) => ({ month, ...v }));
  }, [points]);

  const summary = walletId === "all"
    ? view.summary
    : (() => {
        const ps = points;
        if (ps.length === 0) return null;
        let min = ps[0]!.balance, minDate = ps[0]!.date;
        for (const p of ps) if (p.balance < min) { min = p.balance; minDate = p.date; }
        return { latest: ps[ps.length - 1]!.balance, change: ps[ps.length - 1]!.balance - ps[0]!.balance, min, max: 0, minDate };
      })();

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px 48px" }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 4 }}>口座残高</h1>
      <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: "0 0 16px" }}>
        {new Date(view.fetchedAt).toLocaleString("ja-JP")} 時点
      </p>

      {view.isSample && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant="warning" title="見本のデータです">
            {view.fallbackReason ?? "freee に接続していません"}。
            画面の作りを確かめるための数字で、<strong>実際の残高ではありません</strong>。
            接続するには <code>FREEE_CLIENT_ID</code> などの設定が必要です。
          </Alert>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" }}>
          表示する口座
          <Select
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            options={[
              { label: "すべて（カードを除く）", value: "all" },
              ...view.histories.map((h) => ({ label: `${h.name}（${TYPE_LABEL[h.type] ?? h.type}）`, value: String(h.walletableId) })),
            ]}
          />
        </label>
        <span style={{ fontSize: 11.5, color: "var(--color-muted)", paddingBottom: 6 }}>
          合算は<strong>カードを除きます</strong>（負債のため、含めると実際より多く見えます）
        </span>
      </div>

      {summary && (
        <DashboardGrid>
          <DashboardWidget colSpan={3} bare>
            <SimpleStatCard label="いまの残高" value={summary.latest.toLocaleString()} hint="円" />
          </DashboardWidget>
          <DashboardWidget colSpan={3} bare>
            <SimpleStatCard
              label="期間中の増減"
              value={`${summary.change >= 0 ? "+" : ""}${summary.change.toLocaleString()}`}
              hint="円"
            />
          </DashboardWidget>
          <DashboardWidget colSpan={6} bare>
            <SimpleStatCard
              label="いちばん少なかった日"
              value={summary.min.toLocaleString()}
              hint={`円（${summary.minDate}）— 資金繰りで最初に見るところ`}
            />
          </DashboardWidget>
        </DashboardGrid>
      )}

      <div style={{ marginTop: 20 }}>
        <LineChart
          title="残高の推移"
          data={chartData}
          xKey="date"
          series={[{ key: "残高", name: "残高（円）" }]}
          height={280}
        />
      </div>

      {monthly.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <BarChart
            title="月ごとの入出金"
            data={monthly}
            xKey="month"
            series={[
              { key: "入金", name: "入金（円）" },
              { key: "出金", name: "出金（円）" },
            ]}
            height={240}
          />
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>口座ごとの残高</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {view.histories.map((h) => {
            const last = h.points[h.points.length - 1];
            return (
              <div
                key={h.walletableId}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  padding: 12,
                  background: "var(--color-surface)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{h.name}</span>
                  <Badge variant={h.type === "credit_card" ? "warning" : "secondary"}>
                    {TYPE_LABEL[h.type] ?? h.type}
                  </Badge>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace" }}>
                  {last ? yen(last.balance) : "—"}
                </div>
                {h.type === "credit_card" && (
                  <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 4 }}>
                    負債のため、合算には含めていません
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.9, marginTop: 24 }}>
        残高は freee の同期に依存します。<strong>銀行と繋いでいない口座は、帳簿上の残高</strong>が出ます
        （実際の口座と一致しないことがあります）。
      </p>
    </main>
  );
}
