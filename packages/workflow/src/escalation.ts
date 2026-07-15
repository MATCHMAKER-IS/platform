/**
 * 承認の催促・エスカレーション(SLA)。
 * 現在ステップが滞留している時間を判定し、「催促通知を出すべきか」「上位者へエスカレーションすべきか」を返す。
 * 定期実行(cron)から回して、滞留中の申請を洗い出す用途を想定。純ロジック(副作用なし)。
 * @packageDocumentation
 */
import type { WorkflowDefinition, WorkflowState, WorkflowStep } from "./index.js";

/** SLA ポリシー(分単位)。 */
export interface SlaPolicy {
  /** この分数を超えたら催促を開始(未指定なら催促しない)。 */
  remindAfterMin?: number;
  /** 催促の再送間隔(分)。未指定なら 1 回だけ。 */
  reminderIntervalMin?: number;
  /** この分数を超えたらエスカレーション(未指定ならしない)。 */
  escalateAfterMin?: number;
}

/**
 * 現在の pending ステップが「いつから待ち状態か」を求める。
 * 直近の履歴イベントの時刻、履歴が無ければ startedAt(ワークフロー開始時刻)を使う。
 */
export function pendingSince(state: WorkflowState, startedAt: Date): Date {
  if (state.status !== "pending") return startedAt;
  const last = state.history[state.history.length - 1];
  return last ? new Date(last.at) : startedAt;
}

/** SLA 判定結果。 */
export interface SlaEvaluation {
  /** 滞留時間(分)。 */
  overdueMinutes: number;
  /** 実施すべき対応。優先度: escalate > remind > none。 */
  action: "none" | "remind" | "escalate";
  /** これまでに送られているべき催促回数(interval ベース)。 */
  dueReminderCount: number;
}

/**
 * SLA を評価する。エスカレーション条件を満たせば "escalate"、催促条件のみなら "remind"。
 * @param remindersSent 既に送った催促回数(重複送信の抑止用)。
 */
export function evaluateSla(
  pendingSinceDate: Date,
  now: Date,
  policy: SlaPolicy,
  options?: { remindersSent?: number },
): SlaEvaluation {
  const overdueMinutes = Math.max(0, (now.getTime() - pendingSinceDate.getTime()) / 60_000);
  const remindersSent = options?.remindersSent ?? 0;

  // これまでに送られているべき催促回数
  let dueReminderCount = 0;
  if (policy.remindAfterMin !== undefined && overdueMinutes >= policy.remindAfterMin) {
    if (policy.reminderIntervalMin && policy.reminderIntervalMin > 0) {
      dueReminderCount = 1 + Math.floor((overdueMinutes - policy.remindAfterMin) / policy.reminderIntervalMin);
    } else {
      dueReminderCount = 1;
    }
  }

  const shouldEscalate = policy.escalateAfterMin !== undefined && overdueMinutes >= policy.escalateAfterMin;
  const shouldRemind = dueReminderCount > remindersSent;

  return {
    overdueMinutes,
    action: shouldEscalate ? "escalate" : shouldRemind ? "remind" : "none",
    dueReminderCount,
  };
}

/**
 * エスカレーション先のステップ(=次段の承認者)を返す。
 * 既定は「現在ステップの1つ上(次段)」。最終段なら null(それ以上の上位がない)。
 * chain を渡すと現在の approverRole からエスカレーション先ロールを引ける。
 */
export function escalationTarget(
  def: WorkflowDefinition,
  state: WorkflowState,
  options?: { chain?: Record<string, string> },
): WorkflowStep | { approverRole: string } | null {
  if (state.status !== "pending") return null;
  const cur = def.steps[state.currentStep];
  if (!cur) return null;
  if (options?.chain && options.chain[cur.approverRole]) {
    return { approverRole: options.chain[cur.approverRole]! };
  }
  return def.steps[state.currentStep + 1] ?? null;
}

/** 滞留中の申請 1 件(バッチ判定の入力)。 */
export interface PendingItem {
  id: string;
  state: WorkflowState;
  startedAt: Date;
  /** 既に送った催促回数。 */
  remindersSent?: number;
}

/** バッチ判定の結果 1 件。 */
export interface StalledResult {
  id: string;
  overdueMinutes: number;
  action: "remind" | "escalate";
  dueReminderCount: number;
}

/**
 * 滞留中の申請一覧から、催促・エスカレーションが必要なものだけを抽出する(cron 用)。
 */
export function findStalledApprovals(items: PendingItem[], now: Date, policy: SlaPolicy): StalledResult[] {
  const out: StalledResult[] = [];
  for (const item of items) {
    if (item.state.status !== "pending") continue;
    const since = pendingSince(item.state, item.startedAt);
    const ev = evaluateSla(since, now, policy, { remindersSent: item.remindersSent ?? 0 });
    if (ev.action !== "none") {
      out.push({ id: item.id, overdueMinutes: ev.overdueMinutes, action: ev.action, dueReminderCount: ev.dueReminderCount });
    }
  }
  return out;
}
