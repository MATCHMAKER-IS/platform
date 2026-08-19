/**
 * 社内アプリの権限ポリシー(ロール階層)と機能定義。
 * @packageDocumentation
 */
import { resolveHierarchy, type Policy } from "@platform/auth";

/** ロール階層。employee → manager/finance → admin。 */
export const APP_POLICY: Policy = resolveHierarchy({
  employee: {
    permissions: [
      "expense:read:own", "expense:create", "expense:import",
      "attendance:read:own", "attendance:submit",
      "chat:read", "chat:post",
      "board:read", "board:post", "cms:read", "cms:edit", "inventory:read", "invoice:read", "quote:read", "purchase:read", "equipment:read", "attendance:read", "attendance:write", "payroll:read", "dashboard:read", "partner:read"],
  },
  editor: {
    inherits: ["employee"],
    permissions: ["cms:publish"],
  },
  // **監査ログ(`audit:read`)は一般社員に渡さない。**
  // 全員の操作履歴 — 誰が何を承認したか、誰の情報を見たか — が読める。
  // 見張る側(管理職・経理・管理者)が持つもの(2026-08 に一般社員から外した)。
  manager: {
    inherits: ["employee"],
    permissions: ["expense:approve:own", "expense:read:any", "attendance:read:any", "audit:read", "attendance:approve", "approval:decide", "inventory:write", "invoice:write", "quote:write", "purchase:write", "partner:write", "inquiry:read", "inquiry:write", "equipment:write"],
  },
  finance: {
    inherits: ["employee"],
    permissions: ["period:lock", "approval:decide", "asset:read", "asset:write", "budget:read", "budget:write", "withholding:read", "withholding:write", "payroll:admin", "accounting:read", "accounting:write", "expense:approve:any", "expense:read:any", "expense:export", "expense:rollback", "pii:unmask"],
  },
  admin: {
    inherits: ["manager", "finance"],
    // "*" ですべて通るが、運用操作は名前を明示しておく
    // (何ができるロールなのかを、定義を読むだけで分かるようにするため)
    permissions: ["*", "system:manage"],
  },
});

/**
 * UI 機能キー → 必要権限(画面の出し分けに使う)。
 *
 * **今は使っていない。** 画面では権限を判定せず、**API 側 262 本**で守る設計にしている
 * ——画面の出し分けは「見た目の親切」であって**セキュリティではない**
 * (画面だけで守ると API を直接叩かれて破られる)。
 *
 * **使うとしたら「押しても 403 になるボタンを隠す」ため**で、
 * その場合も**API 側の判定は外さないこと**。
 *
 * なお `exportReport: "expense:export"` と `attendance:submit` は、
 * **API 側が別の権限で判定している**(`expense:read:any` / `attendance:write`)。
 * この表を使い始めるときは、**API 側と突き合わせてから**にすること
 * ——**表と実装が違うと「権限を持っているのに押せない」**という形で現れる(2026-08)。
 */
export const APP_FEATURES: Record<string, string> = {
  viewAllExpenses: "expense:read:any",
  approveExpenses: "expense:approve:any",
  exportReport: "expense:export",
  rollbackImport: "expense:rollback",
  importExpenses: "expense:import",
  viewAllAttendance: "attendance:read:any",
  approveAttendance: "attendance:approve",
  editCms: "cms:edit",
  publishCms: "cms:publish",
  manageInventory: "inventory:write",
  manageInvoices: "invoice:write",
  manageQuotes: "quote:write",
  managePurchases: "purchase:write",
  viewAccounting: "accounting:read",
  /** 監査ログを見られるか。**一般社員には出さない**(全員の操作履歴が読める)。 */
  viewAudit: "audit:read",
  managePayroll: "payroll:admin",
  viewDashboard: "dashboard:read",
  manageWithholding: "withholding:write",
  manageAssets: "asset:write",
  manageBudget: "budget:write",
  managePartners: "partner:write",
  decideApproval: "approval:decide",
  lockPeriod: "period:lock",
  viewInquiries: "inquiry:read",
  editAccounts: "accounting:read",
  viewDepartments: "accounting:read",
  viewCashflow: "accounting:read",
};
