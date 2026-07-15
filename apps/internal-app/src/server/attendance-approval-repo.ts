/**
 * 勤怠の月次申請・承認リポジトリ。単一ステップ（上長承認）のワークフローを @platform/workflow に委譲する。
 * @packageDocumentation
 */
import { startWorkflow, approve, reject, type WorkflowDefinition, type WorkflowState, type WorkflowStatus, type WorkflowEvent, type Actor } from "@platform/workflow";

/** 勤怠承認のワークフロー定義（上長 = manager の 1 段承認）。 */
export const ATTENDANCE_APPROVAL: WorkflowDefinition = { steps: [{ name: "上長承認", approverRole: "manager" }] };

/** 勤怠の月次申請。 */
export interface AttendanceApproval {
  userId: string;
  month: string;
  status: WorkflowStatus;
  submittedAt: string;
  history: WorkflowEvent[];
}

/** 決裁の結果。 */
export type DecisionResult = { ok: true; approval: AttendanceApproval } | { ok: false; error: string };

function toApproval(userId: string, month: string, submittedAt: string, state: WorkflowState): AttendanceApproval {
  return { userId, month, status: state.status, submittedAt, history: state.history };
}

function stateOf(approval: AttendanceApproval): WorkflowState {
  const isLast = ATTENDANCE_APPROVAL.steps.length - 1;
  return { status: approval.status, currentStep: approval.status === "pending" ? 0 : isLast, history: approval.history };
}

/** 勤怠承認ストア。 */
export interface AttendanceApprovalStore {
  get(userId: string, month: string): Promise<AttendanceApproval | undefined>;
  listPending(): Promise<AttendanceApproval[]>;
  submit(userId: string, month: string): Promise<AttendanceApproval>;
  decide(userId: string, month: string, actor: Actor, action: "approve" | "reject", reason?: string): Promise<DecisionResult>;
}

function decideState(approval: AttendanceApproval, actor: Actor, action: "approve" | "reject", reason: string): { ok: true; state: WorkflowState } | { ok: false; error: string } {
  const state = stateOf(approval);
  const result = action === "approve" ? approve(ATTENDANCE_APPROVAL, state, actor) : reject(ATTENDANCE_APPROVAL, state, actor, reason);
  return result.ok ? { ok: true, state: result.value } : { ok: false, error: result.error.message };
}

/** インメモリ実装。 */
export function createMemoryAttendanceApprovalStore(): AttendanceApprovalStore {
  const byKey = new Map<string, AttendanceApproval>();
  const key = (u: string, m: string) => `${u}:${m}`;
  return {
    async get(userId, month) {
      return byKey.get(key(userId, month));
    },
    async listPending() {
      return [...byKey.values()].filter((a) => a.status === "pending").sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : 1));
    },
    async submit(userId, month) {
      const state = startWorkflow(ATTENDANCE_APPROVAL);
      const approval = toApproval(userId, month, new Date().toISOString(), state);
      byKey.set(key(userId, month), approval);
      return approval;
    },
    async decide(userId, month, actor, action, reason = "") {
      const approval = byKey.get(key(userId, month));
      if (!approval) return { ok: false, error: "申請が見つかりません" };
      const res = decideState(approval, actor, action, reason);
      if (!res.ok) return res;
      const updated = toApproval(userId, month, approval.submittedAt, res.state);
      byKey.set(key(userId, month), updated);
      return { ok: true, approval: updated };
    },
  };
}

// ── Prisma 実装 ──

/** AttendanceApprovalRow の必要部分（履歴は JSON）。 */
export interface AttendanceApprovalRow {
  id: string;
  userId: string;
  month: string;
  status: string;
  submittedAt: string;
  history: unknown;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface AttendanceApprovalStoreDb {
  attendanceApprovalRow: {
    findMany(args: { where: { status: string }; orderBy: { submittedAt: "asc" } }): Promise<AttendanceApprovalRow[]>;
    findUnique(args: { where: { userId_month: { userId: string; month: string } } }): Promise<AttendanceApprovalRow | null>;
    upsert(args: { where: { userId_month: { userId: string; month: string } }; create: { userId: string; month: string; status: string; submittedAt: string; history: unknown }; update: { status: string; submittedAt: string; history: unknown } }): Promise<AttendanceApprovalRow>;
  };
}

function normalizeStatus(v: string): WorkflowStatus {
  return v === "approved" || v === "rejected" ? v : "pending";
}

function rowToApproval(row: AttendanceApprovalRow): AttendanceApproval {
  return { userId: row.userId, month: row.month, status: normalizeStatus(row.status), submittedAt: row.submittedAt, history: Array.isArray(row.history) ? (row.history as WorkflowEvent[]) : [] };
}

/** Prisma 実装。 */
export function createPrismaAttendanceApprovalStore(db: AttendanceApprovalStoreDb): AttendanceApprovalStore {
  async function persist(a: AttendanceApproval): Promise<void> {
    await db.attendanceApprovalRow.upsert({ where: { userId_month: { userId: a.userId, month: a.month } }, create: { userId: a.userId, month: a.month, status: a.status, submittedAt: a.submittedAt, history: a.history }, update: { status: a.status, submittedAt: a.submittedAt, history: a.history } });
  }
  return {
    async get(userId, month) {
      const row = await db.attendanceApprovalRow.findUnique({ where: { userId_month: { userId, month } } });
      return row ? rowToApproval(row) : undefined;
    },
    async listPending() {
      return (await db.attendanceApprovalRow.findMany({ where: { status: "pending" }, orderBy: { submittedAt: "asc" } })).map(rowToApproval);
    },
    async submit(userId, month) {
      const state = startWorkflow(ATTENDANCE_APPROVAL);
      const approval = toApproval(userId, month, new Date().toISOString(), state);
      await persist(approval);
      return approval;
    },
    async decide(userId, month, actor, action, reason = "") {
      const row = await db.attendanceApprovalRow.findUnique({ where: { userId_month: { userId, month } } });
      if (!row) return { ok: false, error: "申請が見つかりません" };
      const approval = rowToApproval(row);
      const res = decideState(approval, actor, action, reason);
      if (!res.ok) return res;
      const updated = toApproval(userId, month, approval.submittedAt, res.state);
      await persist(updated);
      return { ok: true, approval: updated };
    },
  };
}
