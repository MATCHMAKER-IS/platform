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
      "board:read", "board:post", "audit:read", "cms:read", "cms:edit", "inventory:read", "invoice:read", "quote:read", "purchase:read", "attendance:read", "attendance:write", "payroll:read", "dashboard:read", "partner:read"],
  },
  editor: {
    inherits: ["employee"],
    permissions: ["cms:publish"],
  },
  manager: {
    inherits: ["employee"],
    permissions: ["expense:approve:own", "expense:read:any", "attendance:read:any", "attendance:approve", "approval:decide", "inventory:write", "invoice:write", "quote:write", "purchase:write", "partner:write", "inquiry:read", "inquiry:write"],
  },
  finance: {
    inherits: ["employee"],
    permissions: ["period:lock", "approval:decide", "asset:read", "asset:write", "budget:read", "budget:write", "withholding:read", "withholding:write", "payroll:admin", "accounting:read", "expense:approve:any", "expense:read:any", "expense:export", "expense:rollback", "pii:unmask"],
  },
  admin: {
    inherits: ["manager", "finance"],
    // "*" ですべて通るが、運用操作は名前を明示しておく
    // (何ができるロールなのかを、定義を読むだけで分かるようにするため)
    permissions: ["*", "system:manage"],
  },
});

/** UI 機能キー → 必要権限(画面の出し分けに使う)。 */
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
