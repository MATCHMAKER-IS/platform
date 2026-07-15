/**
 * RBAC(ロールベースアクセス制御)。
 *
 * 「どのロールがどの権限を持つか」をポリシーとして定義し、
 * `can()` で判定する。フレームワーク非依存の純ロジックなので、
 * どのアプリからでも再利用できる。
 *
 * @packageDocumentation
 */

/**
 * 権限文字列。`"リソース:操作"` の形式を推奨(例: `"invoice:approve"`)。
 * ワイルドカード `"invoice:*"`(そのリソースの全操作)と
 * `"*"`(全権限=管理者)をサポートする。
 */
export type Permission = string;

/** ロール名(例: `"admin"`, `"sales"`)。 */
export type Role = string;

/** ロール → 付与する権限集合、のポリシー定義。 */
export type Policy = Record<Role, Permission[]>;

/**
 * ポリシーを作成する(型を効かせるためのヘルパー)。
 *
 * @param policy ロールと権限の対応
 * @returns 同じポリシー
 *
 * @example
 * ```ts
 * export const policy = definePolicy({
 *   admin: ["*"],
 *   sales: ["invoice:read", "invoice:create"],
 *   viewer: ["invoice:read"],
 * });
 * ```
 */
export function definePolicy<P extends Policy>(policy: P): P {
  return policy;
}

function permissionMatches(granted: Permission, required: Permission): boolean {
  if (granted === "*") return true;
  if (granted === required) return true;
  // "invoice:*" が "invoice:approve" にマッチ
  if (granted.endsWith(":*")) {
    const prefix = granted.slice(0, -1); // "invoice:"
    return required.startsWith(prefix);
  }
  return false;
}

/**
 * 指定ロール群が、ある権限を持つか判定する。
 *
 * @param policy      ポリシー
 * @param roles       対象ユーザーのロール
 * @param required    必要な権限
 * @returns 権限があれば true
 *
 * @example
 * ```ts
 * can(policy, ["sales"], "invoice:create"); // true
 * can(policy, ["viewer"], "invoice:create"); // false
 * ```
 */
export function can(policy: Policy, roles: Role[], required: Permission): boolean {
  for (const role of roles) {
    const grants = policy[role];
    if (!grants) continue;
    if (grants.some((g) => permissionMatches(g, required))) return true;
  }
  return false;
}

/**
 * ロール群が持つ全権限を展開して返す(重複除去)。
 * ワイルドカードはそのまま含まれる。
 *
 * @param policy ポリシー
 * @param roles  ロール
 * @returns 権限の配列
 */
export function permissionsOf(policy: Policy, roles: Role[]): Permission[] {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const p of policy[role] ?? []) set.add(p);
  }
  return [...set];
}
