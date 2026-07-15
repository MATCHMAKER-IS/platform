/**
 * タスク管理の純ロジック(担当・期限・状態遷移・進捗)。
 *
 * プロジェクト管理もこれで賄う(タスクに projectId を持たせるだけ。
 * 「プロジェクト」は「タスクの束」に過ぎず、別の仕組みを作る必要はない)。
 *
 * DB も UI も知らない。アプリ側でストアと画面を用意して使う。
 * @packageDocumentation
 */
import { AppError, ErrorCode } from "@platform/core";

/** タスクの状態。 */
export type TaskStatus = "todo" | "doing" | "review" | "done" | "canceled";

/** 優先度。 */
export type TaskPriority = "low" | "normal" | "high" | "urgent";

/** タスク 1 件。 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** 担当者(未割り当てなら undefined)。 */
  assignee?: string;
  /** 期限(YYYY-MM-DD)。 */
  dueDate?: string;
  /** 所属プロジェクト(無ければ単独タスク)。 */
  projectId?: string;
  /** 親タスク(サブタスクの場合)。 */
  parentId?: string;
  /** 見積工数(時間)。 */
  estimateHours?: number;
  /** 実績工数(時間)。 */
  actualHours?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 許可する状態遷移。**やり直しはできるが、飛ばせない**。
 * 例: todo → done は不可(着手せずに完了はおかしい)。canceled はどこからでも可。
 */
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ["doing", "canceled"],
  doing: ["review", "todo", "canceled"],
  review: ["done", "doing", "canceled"],
  done: ["doing"], // 差し戻し(バグが見つかった等)
  canceled: ["todo"], // 復活
};

/**
 * その状態遷移が許されるかを判定する。
 *
 * @param from 現在の状態
 * @param to   変えたい状態
 * @returns 許されるなら true(同じ状態への「遷移」も true)
 */
export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return from === to || (TRANSITIONS[from] ?? []).includes(to);
}

/**
 * タスクの状態を変える。許されない遷移は VALIDATION エラー。
 *
 * @example
 * ```ts
 * transition(task, "doing");   // todo → doing: OK
 * transition(task, "done");    // todo → done: エラー(着手せずに完了はできない)
 * ```
 *
 * @param task 対象のタスク
 * @param to   変えたい状態
 * @param now  現在時刻(テスト注入用。既定は実時刻)
 * @returns 状態と updatedAt を更新した**新しい**タスク(元は変更しない)
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 許されない遷移の場合
 */
export function transition(task: Task, to: TaskStatus, now = new Date()): Task {
  if (!canTransition(task.status, to)) {
    throw new AppError(ErrorCode.VALIDATION, `${task.status} から ${to} には変更できません(順序を飛ばせません)`);
  }
  return { ...task, status: to, updatedAt: now.toISOString() };
}

/**
 * 期限切れかを判定する。
 *
 * 完了・中止したタスクは対象外(終わったものを「遅れている」とは言わない)。
 *
 * @param task  対象のタスク
 * @param today 基準日(テスト注入用。既定は今日)
 * @returns 期限を過ぎていて、まだ終わっていないなら true
 */
export function isOverdue(task: Task, today = new Date()): boolean {
  if (!task.dueDate) return false;
  if (task.status === "done" || task.status === "canceled") return false;
  const t = today.toISOString().slice(0, 10);
  return task.dueDate < t;
}

/**
 * 期限までの日数を返す。
 *
 * @param task  対象のタスク
 * @param today 基準日(テスト注入用)
 * @returns 残り日数(過ぎていればマイナス)。期限が無ければ undefined
 */
export function daysUntilDue(task: Task, today = new Date()): number | undefined {
  if (!task.dueDate) return undefined;
  const due = new Date(`${task.dueDate}T00:00:00Z`).getTime();
  const base = new Date(`${today.toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((due - base) / 86_400_000);
}

/** 進捗の集計。 */
export interface TaskProgress {
  total: number;
  done: number;
  /** 完了率(0–1)。canceled は分母から除く。 */
  rate: number;
  /** 状態別の件数。 */
  byStatus: Record<TaskStatus, number>;
  /** 期限切れの数。 */
  overdue: number;
  /** 見積の合計(時間)。 */
  estimateHours: number;
  /** 実績の合計(時間)。 */
  actualHours: number;
}

/**
 * タスク群の進捗を集計する。
 *
 * **中止したタスクは完了率の分母から除く**(やらないと決めたものを未完扱いすると、
 * 進捗が永久に 100% にならないため)。
 *
 * @param tasks 対象のタスク
 * @param today 基準日(期限切れの判定に使う)
 * @returns 件数・完了率・状態別・期限切れ数・工数の合計
 */
export function summarize(tasks: Task[], today = new Date()): TaskProgress {
  const byStatus: Record<TaskStatus, number> = { todo: 0, doing: 0, review: 0, done: 0, canceled: 0 };
  let overdue = 0;
  let estimateHours = 0;
  let actualHours = 0;
  for (const t of tasks) {
    byStatus[t.status] += 1;
    if (isOverdue(t, today)) overdue += 1;
    estimateHours += t.estimateHours ?? 0;
    actualHours += t.actualHours ?? 0;
  }
  // 中止したタスクは「やらないと決めた」ものなので、進捗の分母から外す
  const effective = tasks.length - byStatus.canceled;
  return {
    total: tasks.length,
    done: byStatus.done,
    rate: effective === 0 ? 0 : byStatus.done / effective,
    byStatus,
    overdue,
    estimateHours,
    actualHours,
  };
}

/** 並べ替えの基準。 */
export type TaskSort = "priority" | "dueDate" | "status";

const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const STATUS_ORDER: Record<TaskStatus, number> = { doing: 0, review: 1, todo: 2, done: 3, canceled: 4 };

/**
 * 並べ替える。既定は「優先度 → 期限」。
 * **期限なしは最後**(期限があるものを先に見せる)。
 *
 * @param tasks 対象のタスク
 * @param by    並べ替えの基準(既定は優先度 → 期限)
 * @returns 並べ替えた**新しい配列**(元は変更しない)
 */
export function sortTasks(tasks: Task[], by: TaskSort = "priority"): Task[] {
  const copy = [...tasks];
  if (by === "dueDate") {
    return copy.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }
  if (by === "status") {
    return copy.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }
  return copy.sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

/** 絞り込み条件。 */
export interface TaskFilter {
  status?: TaskStatus[];
  assignee?: string;
  projectId?: string;
  /** 期限切れのみ。 */
  overdueOnly?: boolean;
  /** 親タスクのみ(サブタスクを除く)。 */
  topLevelOnly?: boolean;
}

/**
 * 条件で絞り込む。指定しなかった条件は無視される(AND 条件)。
 *
 * @param tasks  対象のタスク
 * @param filter 絞り込み条件
 * @param today  基準日(overdueOnly の判定に使う)
 * @returns 条件に合うタスクだけの新しい配列
 */
export function filterTasks(tasks: Task[], filter: TaskFilter, today = new Date()): Task[] {
  return tasks.filter((t) => {
    if (filter.status && !filter.status.includes(t.status)) return false;
    if (filter.assignee && t.assignee !== filter.assignee) return false;
    if (filter.projectId && t.projectId !== filter.projectId) return false;
    if (filter.overdueOnly && !isOverdue(t, today)) return false;
    if (filter.topLevelOnly && t.parentId) return false;
    return true;
  });
}

/**
 * かんばん表示用に状態別へ振り分ける。
 *
 * **canceled は出さない**(見たいのは「今やること」。中止したものは一覧で探せば足りる)。
 *
 * @param tasks 対象のタスク
 * @returns todo / doing / review / done の 4 列(各列は優先度順)
 */
export function toKanban(tasks: Task[]): { status: TaskStatus; tasks: Task[] }[] {
  const order: TaskStatus[] = ["todo", "doing", "review", "done"];
  return order.map((status) => ({ status, tasks: sortTasks(tasks.filter((t) => t.status === status)) }));
}

/**
 * 担当者ごとの負荷。**誰に偏っているか**を見る。
 * done / canceled は除く(終わった仕事は負荷ではない)。
 *
 * @param tasks 対象のタスク
 * @returns 担当者ごとの件数と見積工数(工数の多い順)。未割り当ては `(未割り当て)` として集計
 *
 * @example
 * ```ts
 * for (const w of workloadByAssignee(tasks)) {
 *   console.log(`${w.assignee}: ${w.count} 件 / ${w.hours}h`);
 * }
 * ```
 */
export function workloadByAssignee(tasks: Task[]): { assignee: string; count: number; hours: number }[] {
  const map = new Map<string, { count: number; hours: number }>();
  for (const t of tasks) {
    if (t.status === "done" || t.status === "canceled") continue;
    const key = t.assignee ?? "(未割り当て)";
    const cur = map.get(key) ?? { count: 0, hours: 0 };
    map.set(key, { count: cur.count + 1, hours: cur.hours + (t.estimateHours ?? 0) });
  }
  return [...map.entries()]
    .map(([assignee, v]) => ({ assignee, ...v }))
    .sort((a, b) => b.hours - a.hours || b.count - a.count);
}
