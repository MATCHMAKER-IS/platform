/**
 * 汎用の伝票承認リポジトリ。発注・請求など任意の伝票に、金額閾値つき多段承認を適用する。
 * ワークフローは @platform/workflow、金額ルーティングは approval-flow に委譲する。
 * @packageDocumentation
 */
import { startWorkflow, approve, reject, sendBack, type WorkflowState, type WorkflowStatus, type WorkflowEvent, type Actor } from "@platform/workflow";
import { routeForAmount } from "./approval-flow";

/** 承認対象の伝票種別。 */
export type DocType = "purchase" | "invoice";

/** 伝票の承認状態。 */
export interface DocApproval {
  docType: DocType;
  docNumber: string;
  amount: number;
  status: WorkflowStatus;
  /** 現在の承認ステップ（0 始まり）。 */
  currentStep: number;
  /** 承認段数（金額で決まる）。 */
  totalSteps: number;
  submittedAt: string;
  /**
   * **誰が出したか。**
   *
   * 無いと**自己承認を防げず、「誰が出した文書か」も追えません**
   * ——2026-08 に追加しました。
   *
   * **それ以前の行は空文字**です（**分からないものを推測しない**ため）——
   * 空のときは**自己承認の判定ができない**ので、**人が確かめて**ください。
   */
  submittedBy: string;
  history: WorkflowEvent[];
}

/** 決裁結果。 */
export type DecisionResult = { ok: true; approval: DocApproval } | { ok: false; error: string };

function toApproval(docType: DocType, docNumber: string, amount: number, submittedAt: string, submittedBy: string, state: WorkflowState): DocApproval {
  return { docType, docNumber, amount, submittedBy, status: state.status, currentStep: state.currentStep, totalSteps: routeForAmount(amount).steps.length, submittedAt, history: state.history };
}

function stateOf(a: DocApproval): WorkflowState {
  return { status: a.status, currentStep: a.currentStep, history: a.history };
}

function decideState(a: DocApproval, actor: Actor, action: "approve" | "reject" | "sendback", reason: string): { ok: true; state: WorkflowState } | { ok: false; error: string } {
  const def = routeForAmount(a.amount);
  const state = stateOf(a);
  // **`sendback` を復活させる。** attendance-approval-repo.ts と同じ
  // 機能欠落があった——`action` の型が 2 値しか受け付けず、`sendBack`
  // を呼ぶ経路が存在しなかった(2026-08 に発見)。
  const result =
    action === "approve" ? approve(def, state, actor)
    : action === "reject" ? reject(def, state, actor, reason)
    : sendBack(def, state, actor, { reason });
  return result.ok ? { ok: true, state: result.value } : { ok: false, error: result.error.message };
}

/** 伝票承認ストア。 */
export interface DocApprovalStore {
  get(docType: DocType, docNumber: string): Promise<DocApproval | undefined>;
  listPending(): Promise<DocApproval[]>;
  listByType(docType: DocType): Promise<DocApproval[]>;
  /**
   * 決裁に出す。
   *
   * **`submittedBy` を必ず渡してください**——
   * 無いと**自己承認を防げず、「誰が出した文書か」も追えません**。
   */
  submit(docType: DocType, docNumber: string, amount: number, submittedBy: string): Promise<DocApproval>;
  decide(docType: DocType, docNumber: string, actor: Actor, action: "approve" | "reject" | "sendback", reason?: string): Promise<DecisionResult>;
}

/** インメモリ実装。 */
export function createMemoryDocApprovalStore(): DocApprovalStore {
  const byKey = new Map<string, DocApproval>();
  const key = (t: DocType, n: string) => `${t}:${n}`;
  return {
    async get(docType, docNumber) {
      return byKey.get(key(docType, docNumber));
    },
    async listPending() {
      return [...byKey.values()].filter((a) => a.status === "pending").sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : 1));
    },
    async listByType(docType) {
      return [...byKey.values()].filter((a) => a.docType === docType);
    },
    async submit(docType, docNumber, amount, submittedBy) {
      const state = startWorkflow(routeForAmount(amount));
      const approval = toApproval(docType, docNumber, amount, new Date().toISOString(), submittedBy, state);
      byKey.set(key(docType, docNumber), approval);
      return approval;
    },
    async decide(docType, docNumber, actor, action, reason = "") {
      const approval = byKey.get(key(docType, docNumber));
      // **無ければここで打ち切る。** 以前は `!approval` のチェックより先に
      // `approval.submittedBy` を参照しており、`approval` が `undefined`
      // だと必ず例外を投げていた(2026-08、submittedAt の移行時に発見。
      // Prisma 実装は最初から正しい順序だった——影響はメモリ実装のみ)。
      if (!approval) return { ok: false, error: "申請が見つかりません" };

      // **自分が出した文書を自分で承認させない。**
      //
      // 経費・勤怠と同じ理由です——**兼務の人**で起きます。
      // **不正のためでなく、うっかり**で押せてしまいます。
      //
      // **`submittedBy` が空なら判定できません**（2026-08 より前の行）——
      // **止めるより通す**方を選んでいます。**古い申請を処理できなくなる**ためです。
      // その場合は**人が確かめて**ください。
      //
      // **差し戻し(`sendback`)は除外する。** 自分で取り下げるのは正当な
      // 操作(2026-08、sendback を機能欠落から復活させた際に、この除外も
      // 正しく戻した——`attendance-approval-repo.ts` と同じ経緯)。
      if (action !== "sendback"
        && approval.submittedBy !== ""
        && actor.id === approval.submittedBy) {
        return {
          ok: false,
          error: "自分が出した文書は自分で承認・却下できません（取り下げる場合は差し戻してください）",
        };
      }
      const res = decideState(approval, actor, action, reason);
      if (!res.ok) return res;
      const updated = toApproval(docType, docNumber, approval.amount, approval.submittedAt, approval.submittedBy, res.state);
      byKey.set(key(docType, docNumber), updated);
      return { ok: true, approval: updated };
    },
  };
}

// ── Prisma 実装 ──

/** DocApprovalRow の必要部分（履歴は JSON）。 */
export interface DocApprovalRow {
  id: string;
  docType: string;
  docNumber: string;
  amount: number;
  status: string;
  currentStep: number;
  /** DB では `Date`。`DocApproval` の公開契約(`submittedAt: string`)は
   *  変えない——`rowToApproval` の境界で変換する(2026-08)。 */
  submittedAt: Date;
  /** 誰が出したか。以前の行は空文字。DB 型定義に無く、`rowToApproval` が
   *  常に欠落させていた(2026-08、submittedAt の移行時に発見)。 */
  submittedBy: string;
  history: unknown;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface DocApprovalStoreDb {
  docApprovalRow: {
    // **`take` を型に含める。** 実装は 200/300 件の上限を渡しているのに、
    // 以前は型定義に無かった——`as unknown as` キャスト経由だと外部の
    // 型検査では検出されない不整合(2026-08、audit-log.ts と同種を発見)。
    findMany(args: { where: { status: string } | { docType: string }; orderBy: { submittedAt: "asc" }; take: number }): Promise<DocApprovalRow[]>;
    findUnique(args: { where: { docType_docNumber: { docType: string; docNumber: string } } }): Promise<DocApprovalRow | null>;
    upsert(args: { where: { docType_docNumber: { docType: string; docNumber: string } }; create: { docType: string; docNumber: string; amount: number; status: string; currentStep: number; submittedAt: Date; submittedBy: string; history: unknown }; update: { amount: number; status: string; currentStep: number; submittedAt: Date; submittedBy: string; history: unknown } }): Promise<DocApprovalRow>;
  };
}

function normalizeStatus(v: string): WorkflowStatus {
  return v === "approved" || v === "rejected" ? v : "pending";
}
function normalizeType(v: string): DocType {
  return v === "invoice" ? "invoice" : "purchase";
}
function rowToApproval(row: DocApprovalRow): DocApproval {
  return { docType: normalizeType(row.docType), docNumber: row.docNumber, amount: row.amount, status: normalizeStatus(row.status), currentStep: row.currentStep, totalSteps: routeForAmount(row.amount).steps.length, submittedAt: row.submittedAt.toISOString(), submittedBy: row.submittedBy, history: Array.isArray(row.history) ? (row.history as WorkflowEvent[]) : [] };
}

/** Prisma 実装。 */
export function createPrismaDocApprovalStore(db: DocApprovalStoreDb): DocApprovalStore {
  async function persist(a: DocApproval): Promise<void> {
    // **`a.submittedAt` は文字列(公開契約)のまま受け取る。** DB へ書く
    // 直前だけ Date に変換する(2026-08、submittedAt を DateTime に移行)。
    const submittedAt = new Date(a.submittedAt);
    await db.docApprovalRow.upsert({
      where: { docType_docNumber: { docType: a.docType, docNumber: a.docNumber } },
      create: { docType: a.docType, docNumber: a.docNumber, amount: a.amount, status: a.status, currentStep: a.currentStep, submittedAt, submittedBy: a.submittedBy, history: a.history },
      update: { amount: a.amount, status: a.status, currentStep: a.currentStep, submittedAt, submittedBy: a.submittedBy, history: a.history },
    });
  }
  return {
    async get(docType, docNumber) {
      const row = await db.docApprovalRow.findUnique({ where: { docType_docNumber: { docType, docNumber } } });
      return row ? rowToApproval(row) : undefined;
    },
    async listPending() {
      return (await db.docApprovalRow.findMany({ where: { status: "pending" }, take: 200, orderBy: { submittedAt: "asc" } })).map(rowToApproval);
    },
    async listByType(docType) {
      return (await db.docApprovalRow.findMany({ where: { docType }, take: 300, orderBy: { submittedAt: "asc" } })).map(rowToApproval);
    },
    async submit(docType, docNumber, amount, submittedBy) {
      const state = startWorkflow(routeForAmount(amount));
      const approval = toApproval(docType, docNumber, amount, new Date().toISOString(), submittedBy, state);
      await persist(approval);
      return approval;
    },
    async decide(docType, docNumber, actor, action, reason = "") {
      const row = await db.docApprovalRow.findUnique({ where: { docType_docNumber: { docType, docNumber } } });
      if (!row) return { ok: false, error: "申請が見つかりません" };
      const approval = rowToApproval(row);
      // **自分が出した文書を自分で承認させない。** メモリ実装にはこの
      // チェックがあったが、Prisma 実装には無かった——2 つの実装が
      // 食い違っていた(2026-08、submittedAt の移行時に発見)。
      if (action !== "sendback"
        && approval.submittedBy !== ""
        && actor.id === approval.submittedBy) {
        return {
          ok: false,
          error: "自分が出した文書は自分で承認・却下できません（取り下げる場合は差し戻してください）",
        };
      }
      const res = decideState(approval, actor, action, reason);
      if (!res.ok) return res;
      const updated = toApproval(docType, docNumber, approval.amount, approval.submittedAt, approval.submittedBy, res.state);
      await persist(updated);
      return { ok: true, approval: updated };
    },
  };
}
