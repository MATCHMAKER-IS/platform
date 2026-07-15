/**
 * 権限マトリクス。認可ポリシー（ロール→権限）から、ロール×機能の対応表を作る。純粋な組み立てのみ。
 * @packageDocumentation
 */
import { type Policy } from "@platform/auth";

/** 一覧に表示する主要権限（表示名つき）。 */
export const KNOWN_PERMISSIONS: { key: string; label: string }[] = [
  { key: "expense:create", label: "経費申請" },
  { key: "expense:approve:any", label: "経費承認" },
  { key: "invoice:read", label: "請求 閲覧" },
  { key: "invoice:write", label: "請求 作成" },
  { key: "purchase:write", label: "発注 作成" },
  { key: "approval:decide", label: "伝票承認" },
  { key: "partner:write", label: "取引先 編集" },
  { key: "inventory:write", label: "在庫 編集" },
  { key: "accounting:read", label: "会計 閲覧" },
  { key: "period:lock", label: "締めロック" },
  { key: "asset:write", label: "固定資産 編集" },
  { key: "budget:write", label: "予算 編集" },
  { key: "payroll:admin", label: "給与 管理" },
  { key: "inquiry:read", label: "問い合わせ 対応" },
  { key: "cms:publish", label: "CMS 公開" },
  { key: "dashboard:read", label: "ダッシュボード" },
];

/** ロールが権限を持つか（ワイルドカード対応）。 */
export function roleHas(policy: Policy, role: string, permission: string): boolean {
  const perms = policy[role] ?? [];
  return perms.includes("*") || perms.includes(permission);
}

/** ロール×権限の対応表。rows は権限ごとに各ロールの可否を持つ。 */
export function permissionMatrix(policy: Policy, roles: string[], permissions: { key: string; label: string }[] = KNOWN_PERMISSIONS): { roles: string[]; rows: { key: string; label: string; allow: boolean[] }[] } {
  return {
    roles,
    rows: permissions.map((p) => ({ key: p.key, label: p.label, allow: roles.map((r) => roleHas(policy, r, p.key)) })),
  };
}

/** ロール由来の権限と個別付与権限を合成した実効権限。ワイルドカードはそのまま含める。 */
export function effectivePermissions(policy: Policy, roles: string[], extra: string[] = []): string[] {
  const set = new Set<string>();
  for (const r of roles) for (const p of policy[r] ?? []) set.add(p);
  for (const p of extra) set.add(p);
  return [...set].sort();
}
