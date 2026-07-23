"use client";
/**
 * 契約の画面。**「今やるべき対応」を最初に見せる**ことに集中する。
 *
 * 契約管理でいちばん困るのは「解約予告の期限を過ぎて、不要な契約が 1 年延びる」こと。
 * 一覧を眺めて自分で気づくのは無理なので、機械が見つけて先頭に出す。
 *
 * 判定・集計はすべて `@platform/contract` の担当。この画面は表示と操作の受け渡しだけ。
 */
import * as React from "react";
import { Button } from "@platform/ui";
import type { Contract, ContractAlert, ContractSummary } from "@platform/contract";

interface ContractView extends Contract {
  daysLeft: number;
  noticeDeadline?: string;
  canGiveNotice: boolean;
}
interface Data { alerts: ContractAlert[]; summary: ContractSummary; contracts: ContractView[] }

const LEVEL_COLOR: Record<string, string> = {
  danger: "var(--color-danger, #dc2626)",
  warning: "var(--color-warning, #d97706)",
  info: "var(--color-muted, #6b7280)",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "作成中", pending: "承認待ち", active: "有効", expired: "満了", terminated: "解約済",
};
const RENEWAL_LABEL: Record<string, string> = { auto: "自動更新", manual: "手動更新", none: "更新なし" };

export function ContractsClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    const r = await doFetch("/api/contracts");
    const d = (await r.json()) as Data & { error?: string };
    if (r.ok) { setData(d); setError(""); }
    else setError(d.error ?? "取得に失敗しました");
  }, [doFetch]);

  React.useEffect(() => { void load(); }, [load]);

  const act = async (id: string, action: "renew" | "terminate") => {
    const r = await doFetch("/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (r.ok) await load();
    else setError(((await r.json()) as { error?: string }).error ?? "操作に失敗しました");
  };

  if (error && !data) return <div style={{ padding: 40, color: "var(--color-danger, #c00)" }}>{error}</div>;
  if (!data) return <div style={{ padding: 40, color: "var(--color-muted, #888)" }}>読み込み中…</div>;

  const card: React.CSSProperties = {
    background: "var(--color-surface, #fff)", border: "1px solid var(--color-border, #e5e7eb)",
    borderRadius: "var(--radius, 10px)", padding: 16, marginBottom: 12,
  };
  const yen = (n?: number) => (n === undefined ? "—" : `¥${n.toLocaleString()}`);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 22 }}>契約</h1>

      {error && <div style={{ ...card, borderLeft: "4px solid var(--color-danger, #c00)", color: "var(--color-danger, #c00)", fontSize: 13 }}>{error}</div>}

      {/* 要約 */}
      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
          {[
            ["有効な契約", `${data.summary.active} 件`, false],
            ["年間金額", yen(data.summary.activeAmount), false],
            ["対応が必要", `${data.summary.urgent} 件`, data.summary.urgent > 0],
            ["期限切れのまま", `${data.summary.expired} 件`, data.summary.expired > 0],
          ].map(([label, value, warn]) => (
            <div key={String(label)} style={{ padding: 8, borderRadius: 8, background: "var(--color-bg, #f9fafb)" }}>
              <div style={{ fontSize: 11, color: "var(--color-muted, #888)" }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: warn ? "var(--color-danger, #c00)" : "var(--color-fg, #111)" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 今やるべき対応(最重要。これを見せるための画面) */}
      <div style={{ ...card, borderLeft: data.alerts.some((a) => a.level === "danger") ? "4px solid var(--color-danger, #c00)" : undefined }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>今やるべき対応（{data.alerts.length}）</div>
        <p style={{ fontSize: 11, color: "var(--color-muted, #888)", margin: "2px 0 8px" }}>
          放っておくと損をするものから順に出しています
        </p>
        {data.alerts.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--color-success, #16a34a)" }}>対応が必要な契約はありません。</p>
        )}
        {data.alerts.map((a, i) => (
          <div key={i} style={{ padding: "8px 0", borderTop: i > 0 ? "1px solid var(--color-border, #f3f4f6)" : "none" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, color: "#fff", background: LEVEL_COLOR[a.level] }}>
                {a.level === "danger" ? "至急" : a.level === "warning" ? "注意" : "参考"}
              </span>
              <strong style={{ fontSize: 13 }}>{a.contract.title}</strong>
              <span style={{ fontSize: 11, color: "var(--color-muted, #888)" }}>{a.contract.partner}</span>
              {a.contract.owner && <span style={{ fontSize: 11, color: "var(--color-muted, #999)" }}>担当: {a.contract.owner}</span>}
            </div>
            <div style={{ fontSize: 12, marginTop: 3, marginLeft: 4 }}>{a.message}</div>
            <div style={{ fontSize: 12, marginTop: 2, marginLeft: 4, color: LEVEL_COLOR[a.level] }}>→ {a.action}</div>
          </div>
        ))}
      </div>

      {/* 一覧(終了が近い順) */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>契約一覧</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "var(--color-muted, #888)", textAlign: "left" }}>
              <th style={th}>契約</th>
              <th style={th}>取引先</th>
              <th style={th}>状態</th>
              <th style={th}>更新</th>
              <th style={th}>終了日</th>
              <th style={th}>解約予告期限</th>
              <th style={{ ...th, textAlign: "right" }}>金額</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {data.contracts.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--color-border, #f3f4f6)" }}>
                <td style={td}>{c.title}</td>
                <td style={td}>{c.partner}</td>
                <td style={td}>{STATUS_LABEL[c.status] ?? c.status}</td>
                <td style={td}>
                  {RENEWAL_LABEL[c.renewalType] ?? c.renewalType}
                  {c.renewalMonths ? `(${c.renewalMonths}ヶ月)` : ""}
                </td>
                <td style={{ ...td, color: c.daysLeft < 0 ? "var(--color-danger, #c00)" : c.daysLeft <= 30 ? "var(--color-warning, #b45309)" : "inherit" }}>
                  {c.endDate}
                  <span style={{ fontSize: 10, color: "var(--color-muted, #999)", marginLeft: 4 }}>
                    {c.daysLeft < 0 ? `${-c.daysLeft}日超過` : `あと${c.daysLeft}日`}
                  </span>
                </td>
                <td style={{ ...td, color: c.noticeDeadline && !c.canGiveNotice ? "var(--color-danger, #c00)" : "inherit" }}>
                  {c.noticeDeadline ?? "—"}
                  {c.noticeDeadline && !c.canGiveNotice && <span style={{ fontSize: 10, marginLeft: 4 }}>過ぎた</span>}
                </td>
                <td style={{ ...td, textAlign: "right" }}>{yen(c.amount)}</td>
                <td style={td}>
                  {c.status === "active" && c.renewalType !== "none" && (
                    <Button onClick={() => void act(c.id, "renew")} style={actBtn}>更新</Button>
                  )}
                  {c.status === "active" && (
                    <Button onClick={() => void act(c.id, "terminate")} style={{ ...actBtn, color: "var(--color-danger, #c00)" }}>解約</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: "4px 6px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "6px" };
const actBtn: React.CSSProperties = {
  padding: "2px 8px", fontSize: 11, marginRight: 4, cursor: "pointer",
  border: "1px solid var(--color-border, #ddd)", borderRadius: 6,
  background: "var(--color-surface, #fff)", color: "var(--color-fg, #111)",
};
