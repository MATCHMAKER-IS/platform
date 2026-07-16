/**
 * 情シス担当の「朝の 30 秒」— タスク・契約・FAQ を横断して**今やるべきこと**を出す。
 *
 * 個々の基盤は「自分の領域」しか知らない。
 * - `@platform/task` … 期限切れのタスクは分かるが、契約のことは知らない
 * - `@platform/contract` … 解約予告の期限は分かるが、タスクのことは知らない
 * - `@platform/faq` … 直すべき FAQ は分かるが、それが誰の仕事かは知らない
 *
 * **横断してひとつの「やることリスト」にするのはアプリの仕事**(基盤の役割ではない)。
 * このデモは、その組み立て方を示す。
 *
 * @packageDocumentation
 */
import { summarize, isOverdue, workloadByAssignee, type Task } from "@platform/task";
import { contractAlerts, summarizeContracts, type Contract } from "@platform/contract";
import { needsReview, summarizeFaq, type FaqItem } from "@platform/faq";

/** 今日やるべきこと 1 件。 */
export interface TodoItem {
  /** どこから来たか。 */
  source: "task" | "contract" | "faq";
  /** 深刻度。**放っておくと損をするものほど高い**。 */
  level: "danger" | "warning" | "info";
  /** 何が起きているか。 */
  title: string;
  /** 何をすべきか。 */
  action: string;
  /** 誰の仕事か(分かれば)。 */
  owner?: string;
  /** 詳細画面へのリンク。 */
  href: string;
}

/** 横断の入力。 */
export interface WorkplaceInput {
  tasks: Task[];
  contracts: Contract[];
  faqs: FaqItem[];
  /** 基準日(テスト注入用)。 */
  today?: Date;
}

/**
 * 3 つの領域から「今日やるべきこと」を集めて、**深刻な順**に並べる。
 *
 * 並び順の考え方: **放っておくと損をするもの**が先。
 * 1. 契約の解約予告期限(過ぎると 1 年延びる = お金が出ていく)
 * 2. 期限切れのタスク(約束を破っている)
 * 3. 役に立っていない FAQ(探した人の時間を奪う)
 *
 * @param input タスク・契約・FAQ と基準日
 * @returns 深刻な順のやることリスト
 *
 * @example
 * ```ts
 * for (const todo of buildTodoList({ tasks, contracts, faqs })) {
 *   console.log(`[${todo.level}] ${todo.title} → ${todo.action}`);
 * }
 * ```
 */
export function buildTodoList(input: WorkplaceInput): TodoItem[] {
  const today = input.today ?? new Date();
  const items: TodoItem[] = [];

  // 1) 契約 — 基盤が判定したアラートをそのまま使う(自作しない)
  for (const alert of contractAlerts(input.contracts, today)) {
    items.push({
      source: "contract",
      level: alert.level,
      title: `${alert.contract.title}: ${alert.message}`,
      action: alert.action,
      ...(alert.contract.owner ? { owner: alert.contract.owner } : {}),
      href: `/contracts#${alert.contract.id}`,
    });
  }

  // 2) タスク — 期限切れだけを拾う(基盤の isOverdue に判定を委ねる)
  for (const task of input.tasks) {
    if (!isOverdue(task, today)) continue;
    items.push({
      source: "task",
      level: task.priority === "urgent" || task.priority === "high" ? "danger" : "warning",
      title: `${task.title}: 期限(${task.dueDate})を過ぎています`,
      action: task.assignee ? `${task.assignee} さんに状況を確認してください` : "担当者を決めてください",
      ...(task.assignee ? { owner: task.assignee } : {}),
      href: `/tasks#${task.id}`,
    });
  }

  // 3) FAQ — 要見直しを拾う(基盤の needsReview に判定を委ねる)
  for (const { item, reason } of needsReview(input.faqs)) {
    items.push({
      source: "faq",
      level: "info",
      title: `FAQ「${item.question}」: ${reason}`,
      action: "内容を見直すか、アーカイブしてください",
      href: `/faq#${item.id}`,
    });
  }

  const order: Record<TodoItem["level"], number> = { danger: 0, warning: 1, info: 2 };
  const sourceOrder: Record<TodoItem["source"], number> = { contract: 0, task: 1, faq: 2 };
  return items.sort(
    (a, b) => order[a.level] - order[b.level] || sourceOrder[a.source] - sourceOrder[b.source],
  );
}

/** 朝に見る要約。 */
export interface MorningSummary {
  /** 今日やるべきことの件数。 */
  todoCount: number;
  /** そのうち「至急」。 */
  urgentCount: number;
  /** タスクの進捗(0–1)。 */
  taskProgress: number;
  /** 期限切れタスクの数。 */
  overdueTasks: number;
  /** 有効な契約の年間金額。 */
  contractAmount: number;
  /** FAQ の役に立った率(投票が無ければ undefined)。 */
  faqHelpfulRate: number | undefined;
  /** 最も負荷の高い担当者(未完タスクの工数順)。 */
  busiestPerson: { assignee: string; count: number; hours: number } | undefined;
}

/**
 * 朝に見る 1 画面分の要約を作る。
 *
 * **各領域の集計は基盤に任せ、ここは束ねるだけ**(集計ロジックを再実装しない)。
 *
 * @param input タスク・契約・FAQ と基準日
 * @returns 要約
 */
export function morningSummary(input: WorkplaceInput): MorningSummary {
  const today = input.today ?? new Date();
  const todos = buildTodoList(input);
  const taskStats = summarize(input.tasks, today);
  const contractStats = summarizeContracts(input.contracts, today);
  const faqStats = summarizeFaq(input.faqs);
  const workload = workloadByAssignee(input.tasks);

  return {
    todoCount: todos.length,
    urgentCount: todos.filter((t) => t.level === "danger").length,
    taskProgress: taskStats.rate,
    overdueTasks: taskStats.overdue,
    contractAmount: contractStats.activeAmount,
    faqHelpfulRate: faqStats.helpfulRate,
    busiestPerson: workload[0],
  };
}

/**
 * 担当者ごとに「その人がやるべきこと」をまとめる。
 *
 * 朝会で「今日は誰が何をするか」を確認するのに使う。
 * **担当者が決まっていないものは `(未割り当て)`** に入れる(放置されがちなので目立たせる)。
 *
 * @param todos {@link buildTodoList} の結果
 * @returns 担当者ごとのやることリスト(件数の多い順)
 */
export function groupByOwner(todos: TodoItem[]): { owner: string; items: TodoItem[] }[] {
  const map = new Map<string, TodoItem[]>();
  for (const t of todos) {
    const key = t.owner ?? "(未割り当て)";
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([owner, items]) => ({ owner, items }))
    .sort((a, b) => b.items.length - a.items.length);
}

/** 人が読める形に整形する(朝会のメモ・Slack 通知に使う)。 */
export function formatTodoList(todos: TodoItem[]): string {
  if (todos.length === 0) return "今日やるべきことはありません。";
  const mark: Record<TodoItem["level"], string> = { danger: "🔴", warning: "🟡", info: "⚪" };
  return todos.map((t) => `${mark[t.level]} ${t.title}\n   → ${t.action}${t.owner ? `(${t.owner})` : ""}`).join("\n");
}
