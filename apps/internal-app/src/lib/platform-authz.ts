/**
 * プラットフォーム全体の権限設計(RBAC + 画面アクセス制御)。
 * 全業務ドメイン(受発注・在庫・請求・会計・人事給与・経費・監査)のロール別権限を一元定義し、
 * 画面(ナビ)ごとの必要権限を対応づける。判定は @platform/auth、画面フィルタは @platform/ui に委譲。
 * @packageDocumentation
 */
import { definePolicy, can, canAny, type Policy, type Permission } from "@platform/auth";
import { filterNavByPermission, type NavItem } from "@platform/ui";

/** プラットフォームのロール。 */
export type PlatformRole = "employee" | "sales" | "warehouse" | "accountant" | "hr" | "manager" | "auditor" | "admin";

/**
 * ロール → 許可される権限。命名は "<ドメイン>:<操作>[:スコープ]"。
 * admin は "*"(全許可)。実務では複数ロールを兼務できる。
 */
export const PLATFORM_POLICY: Policy = definePolicy({
  employee: [
    "expense:create", "expense:read:own", "attendance:submit", "attendance:read:own",
  ],
  sales: [
    "quote:create", "quote:read", "order:create", "order:read",
    "invoice:create", "invoice:read", "customer:read",
  ],
  warehouse: [
    "inventory:read", "inventory:adjust", "purchase:create", "purchase:read", "purchase:receive",
  ],
  accountant: [
    "invoice:read", "invoice:issue", "accounting:read", "accounting:post",
    "journal:export", "journal:sync", "tax:read", "report:export",
  ],
  hr: [
    "payroll:read", "payroll:run", "attendance:read:any", "employee:read",
  ],
  manager: [
    "expense:approve", "expense:read:any", "attendance:read:any", "attendance:approve",
    "order:read", "report:read",
  ],
  auditor: [
    "audit:read", "expense:read:any", "invoice:read", "accounting:read", "payroll:read", "report:read",
  ],
  admin: ["*"],
});

/** 権限を持つか判定する。 */
export function userCan(roles: PlatformRole[], permission: Permission): boolean {
  return can(PLATFORM_POLICY, roles, permission);
}

/** 複数権限のいずれかを持つか。 */
export function userCanAny(roles: PlatformRole[], permissions: Permission[]): boolean {
  return canAny(PLATFORM_POLICY, roles, permissions);
}

/** プラットフォームのナビ(画面ごとに必要権限を付与)。 */
export const PLATFORM_NAV: NavItem[] = [
  { label: "ダッシュボード", href: "/" },
  { label: "見積・受注", href: "/orders", permission: "order:read" },
  { label: "発注・入荷", href: "/purchase", permission: "purchase:read" },
  { label: "在庫", href: "/inventory", permission: "inventory:read" },
  { label: "請求", href: "/invoices", permission: "invoice:read" },
  { label: "会計", href: "/accounting", permission: "accounting:read" },
  { label: "経費", href: "/expenses", permission: "expense:read:own" },
  { label: "勤怠・給与", href: "/hr", permission: "payroll:read" },
  { label: "監査ログ", href: "/audit", permission: "audit:read" },
];

/** ロールに応じて閲覧できるナビだけを返す(権限のない画面は非表示)。 */
export function navForRoles(roles: PlatformRole[]): NavItem[] {
  return filterNavByPermission(PLATFORM_NAV, (permission) => userCan(roles, permission));
}
