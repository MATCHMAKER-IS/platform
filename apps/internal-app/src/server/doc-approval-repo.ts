/**
 * 汎用の伝票承認リポジトリ。発注・請求など任意の伝票に、金額閾値つき多段承認を適用する。
 * ワークフローは @platform/workflow、金額ルーティングは approval-flow に委譲する。
 * @packageDocumentation
 */
import { startWorkflow, approve, reject, type WorkflowState, type WorkflowStatus, type WorkflowEvent, type Actor } from "@platform/workflow";
import { routeForAmount } from "./approval-flow.js";

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
  history: WorkflowEvent[];
}

/** 決裁結果。 */
export type DecisionResult = { ok: true; approval: DocApproval } | { ok: false; error: string };

function toApproval(docType: DocType, docNumber: string, amount: number, submittedAt: string, state: WorkflowState): DocApproval {
  return { docType, docNumber, amount, status: state.status, currentStep: state.currentStep, totalSteps: routeForAmount(amount).steps.length, submittedAt, history: state.history };
}

function stateOf(a: DocApproval): WorkflowState {
  return { status: a.status, currentStep: a.currentStep, history: a.history };
}

function decideState(a: DocApproval, actor: Actor, action: "approve" | "reject", reason: string): { ok: true; state: WorkflowState } | { ok: false; error: string } {
  const def = routeForAmount(a.amount);
  const state = stateOf(a);
  const result = action === "approve" ? approve(def, state, actor) : reject(def, state, actor, reason);
  return result.ok ? { ok: true, state: result.value } : { ok: false, error: result.error.message };
}

/** 伝票承認ストア。 */
export interface DocApprovalStore {
  get(docType: DocType, docNumber: string): Promise<DocApproval | undefined>;
  listPending(): Promise<DocApproval[]>;
  listByType(docType: DocType): Promise<DocApproval[]>;
  submit(docType: DocType, docNumber: string, amount: number): Promise<DocApproval>;
  decide(docType: DocType, docNumber: string, actor: Actor, action: "approve" | "reject", reason?: string): Promise<DecisionResult>;
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
    async submit(docType, docNumber, amount) {
      const state = startWorkflow(routeForAmount(amount));
      const approval = toApproval(docType, docNumber, amount, new Date().toISOString(), state);
      byKey.set(key(docType, docNumber), approval);
      return approval;
    },
    async decide(docType, docNumber, actor, action, reason = "") {
      const approval = byKey.get(key(docType, docNumber));
      if (!approval) return { ok: false, error: "申請が見つかりません" };
      const res = decideState(approval, actor, action, reason);
      if (!res.ok) return res;
      const updated = toApproval(docType, docNumber, approval.amount, approval.submittedAt, res.state);
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
  submittedAt: string;
  history: unknown;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface DocApprovalStoreDb {
  docApprovalRow: {
    findMany(args: { where: { status: string } | { docType: string }; orderBy: { submittedAt: "asc" } }): Promise<DocApprovalRow[]>;
    findUnique(args: { where: { docType_docNumber: { docType: string; docNumber: string } } }): Promise<DocApprovalRow | null>;
    upsert(args: { where: { docType_docNumber: { docType: string; docNumber: string } }; create: { docType: string; docNumber: string; amount: number; status: string; currentStep: number; submittedAt: string; history: unknown }; update: { amount: number; status: string; currentStep: number; submittedAt: string; history: unknown } }): Promise<DocApprovalRow>;
  };
}

function normalizeStatus(v: string): WorkflowStatus {
  return v === "approved" || v === "rejected" ? v : "pending";
}
function normalizeType(v: string): DocType {
  return v === "invoice" ? "invoice" : "purchase";
}
function rowToApproval(row: DocApprovalRow): DocApproval {
  return { docType: normalizeType(row.docType), docNumber: row.docNumber, amount: row.amount, status: normalizeStatus(row.status), currentStep: row.currentStep, totalSteps: routeForAmount(row.amount).steps.length, submittedAt: row.submittedAt, history: Array.isArray(row.history) ? (row.history as WorkflowEvent[]) : [] };
}

/** Prisma 実装。 */
export function createPrismaDocApprovalStore(db: DocApprovalStoreDb): DocApprovalStore {
  async function persist(a: DocApproval): Promise<void> {
    await db.docApprovalRow.upsert({
      where: { docType_docNumber: { docType: a.docType, docNumber: a.docNumber } },
      create: { docType: a.docType, docNumber: a.docNumber, amount: a.amount, status: a.status, currentStep: a.currentStep, submittedAt: a.submittedAt, history: a.history },
      update: { amount: a.amount, status: a.status, currentStep: a.currentStep, submittedAt: a.submittedAt, history: a.history },
    });
  }
  return {
    async get(docType, docNumber) {
      const row = await db.docApprovalRow.findUnique({ where: { docType_docNumber: { docType, docNumber } } });
      return row ? rowToApproval(row) : undefined;
    },
    async listPending() {
      return (await db.docApprovalRow.findMany({ where: { status: "pending" }, orderBy: { submittedAt: "asc" } })).map(rowToApproval);
    },
    async listByType(docType) {
      return (await db.docApprovalRow.findMany({ where: { docType }, orderBy: { submittedAt: "asc" } })).map(rowToApproval);
    },
    async submit(docType, docNumber, amount) {
      const state = startWorkflow(routeForAmount(amount));
      const approval = toApproval(docType, docNumber, amount, new Date().toISOString(), state);
      await persist(approval);
      return approval;
    },
    async decide(docType, docNumber, actor, action, reason = "") {
      const row = await db.docApprovalRow.findUnique({ where: { docType_docNumber: { docType, docNumber } } });
      if (!row) return { ok: false, error: "申請が見つかりません" };
      const approval = rowToApproval(row);
      const res = decideState(approval, actor, action, reason);
      if (!res.ok) return res;
      const updated = toApproval(docType, docNumber, approval.amount, approval.submittedAt, res.state);
      await persist(updated);
      return { ok: true, approval: updated };
    },
  };
}
