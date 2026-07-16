/**
 * 使用例: 情シスの朝の 30 秒。
 *
 * **サーバでソースを読み、実行結果も出す**(コードだけだと、何が起きるか分からない)。
 */
import { ExampleView, OutputText } from "../../../components/example-view.js";
import { readExampleSource, excerptSource } from "../../../lib/example-source.js";
import { buildTodoList, formatTodoList, morningSummary } from "../../../examples/workplace-ops.js";
import type { Task } from "@platform/task";
import type { Contract } from "@platform/contract";
import type { FaqItem } from "@platform/faq";

export const metadata = { title: "情シスの朝の30秒(使用例)" };

const NOW = new Date("2026-07-15T09:00:00Z");
const b = { createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z" };
const day = (o: number): string => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + o);
  return d.toISOString().slice(0, 10);
};

const tasks: Task[] = [
  { id: "t1", title: "サーバ証明書の更新", status: "doing", priority: "urgent", assignee: "田中", dueDate: day(-3), estimateHours: 2, ...b },
  { id: "t2", title: "資料整理", status: "todo", priority: "low", dueDate: day(-1), ...b },
  { id: "t3", title: "完了済み", status: "done", priority: "normal", ...b },
];
const contracts: Contract[] = [
  { id: "c1", title: "クラウド契約", partner: "A社", status: "active", startDate: day(-300), endDate: day(45),
    renewalType: "auto", renewalMonths: 12, noticeDays: 60, amount: 1_200_000, owner: "情シス", ...b },
  { id: "c2", title: "清掃委託", partner: "B社", status: "active", startDate: day(-300), endDate: day(3),
    renewalType: "manual", amount: 360_000, owner: "総務", ...b },
];
const faqs: FaqItem[] = [
  { id: "f1", question: "古い情報", answer: "x", category: "経費", keywords: [], status: "published",
    helpful: 1, notHelpful: 9, views: 60, relatedIds: [], ...b },
];

export default function Page() {
  const todos = buildTodoList({ tasks, contracts, faqs, today: NOW });
  const summary = morningSummary({ tasks, contracts, faqs, today: NOW });

  return (
    <ExampleView
      title="情シスの朝の30秒"
      intro="タスク・契約・FAQ を横断して「今やるべきこと」を1つのリストにします。個々の基盤は自分の領域しか知らないので、横断するのはアプリの仕事です。"
      packages={["task", "contract", "faq"]}
      code={excerptSource(readExampleSource("workplace-ops"), 70)}
      output={
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8, marginBottom: 12 }}>
            {[
              ["やること", `${summary.todoCount} 件`],
              ["至急", `${summary.urgentCount} 件`],
              ["期限切れタスク", `${summary.overdueTasks} 件`],
              ["契約の年間額", `¥${summary.contractAmount.toLocaleString()}`],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ padding: 10, borderRadius: 8, background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
          <OutputText text={formatTodoList(todos)} />
        </>
      }
      notes={[
        "並び順は「放っておくと損をするもの」が先: 契約の解約予告(過ぎると1年延びる) → 期限切れタスク → 役に立っていないFAQ",
        "判定は基盤に委ねる(contractAlerts / isOverdue / needsReview)。同じ判定を再実装しない",
        "「何をすべきか」を必ず添える。「期限切れです」だけでは動けない",
        "担当者が決まっていないものは (未割り当て) に入れて目立たせる(放置されがちなため)",
      ]}
    />
  );
}
