/**
 * 勤怠の月次申請・承認リポジトリ。単一ステップ（上長承認）のワークフローを @platform/workflow に委譲する。
 * @packageDocumentation
 */
import { startWorkflow, approve, reject, sendBack, type WorkflowDefinition, type WorkflowState, type WorkflowStatus, type WorkflowEvent, type Actor } from "@platform/workflow";

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
  decide(userId: string, month: string, actor: Actor, action: "approve" | "reject" | "sendback", reason?: string): Promise<DecisionResult>;
}

function decideState(approval: AttendanceApproval, actor: Actor, action: "approve" | "reject" | "sendback", reason: string): { ok: true; state: WorkflowState } | { ok: false; error: string } {
  const state = stateOf(approval);
  // **`sendback` を復活させる。** コメントには「差し戻しは許します」と
  // 明記されていたのに、`action` の型が `"approve" | "reject"` の 2 値
  // しか受け付けていなかった——`sendBack` を呼ぶ経路が存在しなかった
  // (2026-08、`decide` に `"sendback"` を渡せなかった機能欠落を発見)。
  const result =
    action === "approve" ? approve(ATTENDANCE_APPROVAL, state, actor)
    : action === "reject" ? reject(ATTENDANCE_APPROVAL, state, actor, reason)
    : sendBack(ATTENDANCE_APPROVAL, state, actor, { reason });
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
      // **申請者を渡す**(自己承認を防ぐ)
      const state = startWorkflow(ATTENDANCE_APPROVAL, userId);
      const approval = toApproval(userId, month, new Date().toISOString(), state);
      byKey.set(key(userId, month), approval);
      return approval;
    },
    async decide(userId, month, actor, action, reason = "") {
      const approval = byKey.get(key(userId, month));
      if (!approval) return { ok: false, error: "申請が見つかりません" };
      // **自分の勤怠を自分で承認させない。**
      //
      // 経費（`approval-repo.ts`）と同じ理由です——
      // **兼務の人**（承認権限を持つ人が自分の勤怠を出す）で起きます。
      // **不正のためでなく、うっかり**で押せてしまうのが実際のところです。
      //
      // **差し戻しは許します**——**自分で取り下げる**のは正当で、
      // 止めると**間違えて出した申請を取り消せません**。
      //
      // **メモリ実装にはこのチェック自体が無かった。** Prisma 実装には
      // あったのに、2 つの実装が食い違っていた(2026-08、submittedAt の
      // 移行時に発見)。
      if (action !== "sendback" && actor.id === userId) {
        return {
          ok: false,
          error: "自分の勤怠は自分で承認・却下できません（取り下げる場合は差し戻してください）",
        };
      }
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
  /** DB では `Date`。`AttendanceApproval` の公開契約(`submittedAt: string`)は
   *  変えない——`rowToApproval` の境界で変換する(2026-08)。 */
  submittedAt: Date;
  history: unknown;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface AttendanceApprovalStoreDb {
  attendanceApprovalRow: {
    // **`take` を型に含める。** 実装は 200 件の上限を渡しているのに、
    // 以前は型定義に無かった(2026-08、doc-approval-repo.ts と同種を発見)。
    findMany(args: { where: { status: string }; orderBy: { submittedAt: "asc" }; take: number }): Promise<AttendanceApprovalRow[]>;
    findUnique(args: { where: { userId_month: { userId: string; month: string } } }): Promise<AttendanceApprovalRow | null>;
    upsert(args: { where: { userId_month: { userId: string; month: string } }; create: { userId: string; month: string; status: string; submittedAt: Date; history: unknown }; update: { status: string; submittedAt: Date; history: unknown } }): Promise<AttendanceApprovalRow>;
  };
}

function normalizeStatus(v: string): WorkflowStatus {
  return v === "approved" || v === "rejected" ? v : "pending";
}

function rowToApproval(row: AttendanceApprovalRow): AttendanceApproval {
  return { userId: row.userId, month: row.month, status: normalizeStatus(row.status), submittedAt: row.submittedAt.toISOString(), history: Array.isArray(row.history) ? (row.history as WorkflowEvent[]) : [] };
}

/** Prisma 実装。 */
export function createPrismaAttendanceApprovalStore(db: AttendanceApprovalStoreDb): AttendanceApprovalStore {
  async function persist(a: AttendanceApproval): Promise<void> {
    // **`a.submittedAt` は文字列(公開契約)のまま受け取る。** DB へ書く
    // 直前だけ Date に変換する(2026-08、submittedAt を DateTime に移行)。
    const submittedAt = new Date(a.submittedAt);
    await db.attendanceApprovalRow.upsert({ where: { userId_month: { userId: a.userId, month: a.month } }, create: { userId: a.userId, month: a.month, status: a.status, submittedAt, history: a.history }, update: { status: a.status, submittedAt, history: a.history } });
  }
  return {
    async get(userId, month) {
      const row = await db.attendanceApprovalRow.findUnique({ where: { userId_month: { userId, month } } });
      return row ? rowToApproval(row) : undefined;
    },
    async listPending() {
      // **上限を付ける。** 承認待ちは**押されるまで消えません**——
      // 承認者が休むと**溜まり続けます**。
      // **200 件を超えたら、そもそも運用が回っていません**
      // ——件数ではなく「**一番古いものが何日前か**」を見てください。
      return (await db.attendanceApprovalRow.findMany({ where: { status: "pending" }, take: 200, orderBy: { submittedAt: "asc" } })).map(rowToApproval);
    },
    async submit(userId, month) {
      // **申請者を渡す**(自己承認を防ぐ)
      const state = startWorkflow(ATTENDANCE_APPROVAL, userId);
      const approval = toApproval(userId, month, new Date().toISOString(), state);
      await persist(approval);
      return approval;
    },
    async decide(userId, month, actor, action, reason = "") {
      const row = await db.attendanceApprovalRow.findUnique({ where: { userId_month: { userId, month } } });
      if (!row) return { ok: false, error: "申請が見つかりません" };
      const approval = rowToApproval(row);

      // **自分の勤怠を自分で承認させない。**
      //
      // 経費（`approval-repo.ts`）と同じ理由です——
      // **兼務の人**（承認権限を持つ人が自分の勤怠を出す）で起きます。
      // **不正のためでなく、うっかり**で押せてしまうのが実際のところです。
      //
      // **差し戻しは許します**——**自分で取り下げる**のは正当で、
      // 止めると**間違えて出した申請を取り消せません**。
      if (action !== "sendback" && actor.id === userId) {
        return {
          ok: false,
          error: "自分の勤怠は自分で承認・却下できません（取り下げる場合は差し戻してください）",
        };
      }

      const res = decideState(approval, actor, action, reason);
      if (!res.ok) return res;
      const updated = toApproval(userId, month, approval.submittedAt, res.state);
      await persist(updated);
      return { ok: true, approval: updated };
    },
  };
}
