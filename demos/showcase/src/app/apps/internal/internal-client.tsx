"use client";
/**
 * 社内アプリのデモ(モックデータ)。
 *
 * **実物は `apps/internal-app`**(79 画面・213 API・DB あり)。ここはその画面を
 * モックデータで再現したもので、**DB を持たない**。
 *
 * 「こういう画面が作れます」を見せるのが目的なので、機能は絞ってある
 * (実物の全機能を再現すると、それはもう実物になってしまう)。
 */
import * as React from "react";
import { Button } from "@platform/ui";
import { summarize, sortTasks, isOverdue, type Task } from "@platform/task";
import { contractAlerts, type Contract } from "@platform/contract";
import { needsReview, publishedOnly, type FaqItem } from "@platform/faq";

const NOW = new Date("2026-07-15T09:00:00Z");
const base = { createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z" };
const day = (o: number): string => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + o);
  return d.toISOString().slice(0, 10);
};

const TASKS: Task[] = [
  { id: "t1", title: "サーバ証明書の更新", status: "doing", priority: "urgent", assignee: "田中", dueDate: day(-3), estimateHours: 2, ...base },
  { id: "t2", title: "新入社員のPC設定", status: "todo", priority: "high", assignee: "佐藤", dueDate: day(2), estimateHours: 4, ...base },
  { id: "t3", title: "バックアップの検証", status: "todo", priority: "normal", assignee: "田中", dueDate: day(7), estimateHours: 3, ...base },
  { id: "t4", title: "資産台帳の棚卸し", status: "done", priority: "normal", assignee: "鈴木", ...base },
  { id: "t5", title: "VPN設定の見直し", status: "doing", priority: "normal", assignee: "佐藤", dueDate: day(10), estimateHours: 6, ...base },
];

const CONTRACTS: Contract[] = [
  { id: "c1", title: "クラウドストレージ利用契約", partner: "A クラウド", status: "active",
    startDate: day(-300), endDate: day(75), renewalType: "auto", renewalMonths: 12, noticeDays: 60,
    amount: 1_200_000, owner: "情シス", ...base },
  { id: "c2", title: "オフィス清掃業務委託", partner: "C サービス", status: "active",
    startDate: day(-300), endDate: day(5), renewalType: "manual", amount: 360_000, owner: "総務", ...base },
  { id: "c3", title: "業務システム開発委託", partner: "F 開発", status: "active",
    startDate: day(-100), endDate: day(300), renewalType: "auto", renewalMonths: 12, noticeDays: 30,
    amount: 8_000_000, owner: "情シス", ...base },
];

const FAQS: FaqItem[] = [
  { id: "f1", question: "経費の締め切りはいつですか?", answer: "毎月 5 日までに申請してください。", category: "経費",
    keywords: ["精算", "期限"], status: "published", helpful: 24, notHelpful: 2, views: 180, relatedIds: [], ...base },
  { id: "f2", question: "有給休暇の申請方法", answer: "勤怠画面から「休暇申請」を選びます。", category: "勤怠",
    keywords: ["休暇"], status: "published", helpful: 18, notHelpful: 0, views: 140, relatedIds: [], ...base },
  { id: "f3", question: "経費の上限はありますか?", answer: "(古い情報)", category: "経費",
    keywords: [], status: "published", helpful: 1, notHelpful: 11, views: 60, relatedIds: [], ...base },
];

const EXPENSES = [
  { id: "e1", date: day(-2), account: "旅費交通費", partner: "JR東日本", amount: 12_800, status: "承認待ち" },
  { id: "e2", date: day(-5), account: "会議費", partner: "スターバックス", amount: 3_400, status: "承認済" },
  { id: "e3", date: day(-8), account: "消耗品費", partner: "アスクル", amount: 8_900, status: "承認済" },
];

const ATTENDANCE = [
  { date: day(-1), clockIn: "09:02", clockOut: "18:30", overtime: 30, night: 0 },
  { date: day(-2), clockIn: "08:58", clockOut: "21:15", overtime: 195, night: 0 },
  { date: day(-3), clockIn: "09:00", clockOut: "17:45", overtime: 0, night: 0 },
];

type Tab = "overview" | "expenses" | "attendance" | "tasks" | "contracts" | "faq";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "ホーム" },
  { key: "expenses", label: "経費" },
  { key: "attendance", label: "勤怠" },
  { key: "tasks", label: "タスク" },
  { key: "contracts", label: "契約" },
  { key: "faq", label: "FAQ" },
];

export function InternalAppDemo() {
  const [tab, setTab] = React.useState<Tab>("overview");

  const taskStats = summarize(TASKS, NOW);
  const alerts = contractAlerts(CONTRACTS, NOW);
  const review = needsReview(FAQS);

  return (
    <div>
      {/* 実物ではないことを明示する(誤解を招かないため) */}
      <div style={{ ...banner }}>
        これは <strong>デモ</strong> です。実物の社内アプリは <code>apps/internal-app</code>(79 画面・213 API)。
        ここでは <strong>モックデータ</strong>で主要画面を再現しています(DB を使いません)。
      </div>

      {/* アプリ内のタブ(実物のナビを模す) */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--color-border)", padding: "0 16px", overflowX: "auto" }}>
        {TABS.map((t) => (
          <Button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 14px", border: "none", background: "none", cursor: "pointer", fontSize: 13,
              borderBottom: tab === t.key ? "2px solid var(--color-primary)" : "2px solid transparent",
              color: tab === t.key ? "var(--color-primary)" : "var(--color-muted)",
              fontWeight: tab === t.key ? 700 : 400, whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <div style={{ padding: 16, maxWidth: 900 }}>
        {tab === "overview" && (
          <>
            <h2 style={h2}>今日やること</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
              {[
                ["未完了タスク", `${taskStats.total - taskStats.done} 件`, taskStats.overdue > 0],
                ["期限切れ", `${taskStats.overdue} 件`, taskStats.overdue > 0],
                ["契約の要対応", `${alerts.filter((a) => a.level === "danger").length} 件`, alerts.some((a) => a.level === "danger")],
                ["FAQ の要見直し", `${review.length} 件`, false],
              ].map(([label, value, warn]) => (
                <div key={String(label)} style={{ ...card, padding: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: warn ? "var(--color-danger)" : "var(--color-fg)" }}>{value}</div>
                </div>
              ))}
            </div>

            <h3 style={h3}>放っておくと損をするもの</h3>
            <div style={card}>
              {alerts.slice(0, 3).map((a, i) => (
                <div key={i} style={{ padding: "8px 0", borderTop: i > 0 ? "1px solid var(--color-border)" : "none" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ ...pill, background: a.level === "danger" ? "var(--color-danger)" : "var(--color-warning)" }}>
                      {a.level === "danger" ? "至急" : a.level === "warning" ? "注意" : "参考"}
                    </span>
                    <strong style={{ fontSize: 13 }}>{a.contract.title}</strong>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 3 }}>{a.message}</div>
                  <div style={{ fontSize: 12, marginTop: 2, color: "var(--color-muted)" }}>→ {a.action}</div>
                </div>
              ))}
              {alerts.length === 0 && <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0 }}>対応が必要なものはありません。</p>}
            </div>
          </>
        )}

        {tab === "expenses" && (
          <>
            <h2 style={h2}>経費精算</h2>
            <table style={table}>
              <thead>
                <tr style={{ color: "var(--color-muted)", textAlign: "left" }}>
                  <th style={th}>日付</th><th style={th}>科目</th><th style={th}>支払先</th>
                  <th style={{ ...th, textAlign: "right" }}>金額</th><th style={th}>状態</th>
                </tr>
              </thead>
              <tbody>
                {EXPENSES.map((e) => (
                  <tr key={e.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                    <td style={td}>{e.date}</td>
                    <td style={td}>{e.account}</td>
                    <td style={td}>{e.partner}</td>
                    <td style={{ ...td, textAlign: "right" }}>¥{e.amount.toLocaleString()}</td>
                    <td style={td}>{e.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={note}>実物では領収書を撮ると OCR で読み取り、科目を AI が推定します(<code>@platform/ocr</code> / <code>@platform/ai</code>)。</p>
          </>
        )}

        {tab === "attendance" && (
          <>
            <h2 style={h2}>勤怠</h2>
            <table style={table}>
              <thead>
                <tr style={{ color: "var(--color-muted)", textAlign: "left" }}>
                  <th style={th}>日付</th><th style={th}>出勤</th><th style={th}>退勤</th>
                  <th style={{ ...th, textAlign: "right" }}>時間外</th>
                </tr>
              </thead>
              <tbody>
                {ATTENDANCE.map((a) => (
                  <tr key={a.date} style={{ borderTop: "1px solid var(--color-border)" }}>
                    <td style={td}>{a.date}</td>
                    <td style={td}>{a.clockIn}</td>
                    <td style={td}>{a.clockOut}</td>
                    <td style={{ ...td, textAlign: "right", color: a.overtime > 120 ? "var(--color-warning)" : "inherit" }}>
                      {a.overtime > 0 ? `${Math.floor(a.overtime / 60)}h${a.overtime % 60}m` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={note}>割増の計算は <code>@platform/payroll</code>(時間外 25% / 深夜 25% / 休日 35%・重複は加算)。</p>
          </>
        )}

        {tab === "tasks" && (
          <>
            <h2 style={h2}>タスク</h2>
            <div style={card}>
              {sortTasks(TASKS, "priority").map((t, i) => (
                <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", borderTop: i > 0 ? "1px solid var(--color-border)" : "none" }}>
                  <span style={{ ...pill, background: t.status === "done" ? "var(--color-success)" : t.status === "doing" ? "var(--color-primary)" : "var(--color-muted)" }}>
                    {t.status === "done" ? "完了" : t.status === "doing" ? "進行中" : "未着手"}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, textDecoration: t.status === "done" ? "line-through" : "none", color: t.status === "done" ? "var(--color-muted)" : "inherit" }}>
                    {t.title}
                  </span>
                  {t.assignee && <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{t.assignee}</span>}
                  {isOverdue(t, NOW) && <span style={{ fontSize: 11, color: "var(--color-danger)" }}>期限切れ</span>}
                </div>
              ))}
            </div>
            <p style={note}>並べ替えは <code>@platform/task</code> の <code>sortTasks</code>(緊急 → 期限 → 作成順)。</p>
          </>
        )}

        {tab === "contracts" && (
          <>
            <h2 style={h2}>契約</h2>
            <table style={table}>
              <thead>
                <tr style={{ color: "var(--color-muted)", textAlign: "left" }}>
                  <th style={th}>契約</th><th style={th}>取引先</th><th style={th}>更新</th>
                  <th style={th}>終了日</th><th style={{ ...th, textAlign: "right" }}>金額</th>
                </tr>
              </thead>
              <tbody>
                {CONTRACTS.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                    <td style={td}>{c.title}</td>
                    <td style={td}>{c.partner}</td>
                    <td style={td}>{c.renewalType === "auto" ? `自動(${c.renewalMonths}ヶ月)` : "手動"}</td>
                    <td style={td}>{c.endDate}</td>
                    <td style={{ ...td, textAlign: "right" }}>¥{(c.amount ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={note}>
              解約予告の期限は <code>@platform/contract</code> が判定します。
              <strong>過ぎると意図せず 1 年延びる</strong>ので、ホームに「至急」として出します。
            </p>
          </>
        )}

        {tab === "faq" && (
          <>
            <h2 style={h2}>FAQ</h2>
            <div style={card}>
              {publishedOnly(FAQS).map((f, i) => (
                <div key={f.id} style={{ padding: "8px 0", borderTop: i > 0 ? "1px solid var(--color-border)" : "none" }}>
                  <div style={{ fontSize: 13 }}>{f.question}</div>
                  <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                    {f.category} ・ {f.views} 回閲覧 ・ 役に立った {f.helpful}/{f.helpful + f.notHelpful}
                  </div>
                </div>
              ))}
            </div>
            {review.length > 0 && (
              <div style={{ ...card, marginTop: 12, borderLeft: "4px solid var(--color-warning)" }}>
                <strong style={{ fontSize: 13 }}>要見直し({review.length})</strong>
                {review.map((r) => (
                  <div key={r.item.id} style={{ fontSize: 12, marginTop: 4 }}>
                    「{r.item.question}」… {r.reason}
                  </div>
                ))}
              </div>
            )}
            <p style={note}>
              <strong>役に立っていない FAQ は、無いより悪い</strong>(探した人の時間を奪う)ので、
              <code>@platform/faq</code> が機械的に見つけます。
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const banner: React.CSSProperties = {
  padding: "10px 16px", fontSize: 12, lineHeight: 1.7,
  background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)",
  color: "var(--color-muted)",
};
const card: React.CSSProperties = {
  background: "var(--color-surface)", border: "1px solid var(--color-border)",
  borderRadius: "var(--radius, 10px)", padding: 12,
};
const h2: React.CSSProperties = { fontSize: 18, margin: "0 0 12px" };
const h3: React.CSSProperties = { fontSize: 14, margin: "16px 0 8px" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12.5 };
const th: React.CSSProperties = { padding: "6px 8px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "8px" };
const pill: React.CSSProperties = { fontSize: 10, padding: "2px 8px", borderRadius: 999, color: "#fff" };
const note: React.CSSProperties = { fontSize: 11.5, color: "var(--color-muted)", marginTop: 12, lineHeight: 1.7 };
