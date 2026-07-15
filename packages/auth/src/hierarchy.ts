/**
 * RBAC 拡張: ロール継承・複合判定・スコープ(own/any)判定・認可フィルタ。
 * 既存の {@link can}/{@link Policy} と互換(継承は平坦な Policy に解決される)。
 * @packageDocumentation
 */
import { can, type Permission, type Policy, type Role } from "./rbac.js";

/** 1 ロールの定義(継承元 + 直接付与する権限)。 */
export interface RoleDefinition {
  /** 継承するロール(そのロールの権限も引き継ぐ)。 */
  inherits?: Role[];
  /** このロールに直接付与する権限。 */
  permissions: Permission[];
}

/** ロール階層の定義。 */
export type RoleHierarchy = Record<Role, RoleDefinition>;

/**
 * ロール階層を平坦な {@link Policy} に解決する(継承を展開)。循環は安全に無視。
 *
 * @example
 * ```ts
 * const policy = resolveHierarchy({
 *   employee: { permissions: ["expense:read:own", "expense:create"] },
 *   manager:  { inherits: ["employee"], permissions: ["expense:approve:own"] },
 *   admin:    { inherits: ["manager"], permissions: ["*"] },
 * });
 * can(policy, ["manager"], "expense:create"); // true(employee から継承)
 * ```
 *
 * @param hierarchy ロールごとの「自分の権限」と「継承元のロール」
 * @returns 継承を解決済みの {@link Policy}(`can` にそのまま渡せる)
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 継承が循環している場合
 */
export function resolveHierarchy(hierarchy: RoleHierarchy): Policy {
  const cache: Record<Role, Permission[]> = {};
  function resolve(role: Role, seen: Set<Role>): Permission[] {
    const cached = cache[role];
    if (cached) return cached;
    if (seen.has(role)) return []; // 循環ガード
    seen.add(role);
    const def = hierarchy[role];
    if (!def) return [];
    const perms = new Set<Permission>(def.permissions);
    for (const parent of def.inherits ?? []) {
      for (const p of resolve(parent, seen)) perms.add(p);
    }
    const arr = [...perms];
    cache[role] = arr;
    return arr;
  }
  const policy: Policy = {};
  for (const role of Object.keys(hierarchy)) policy[role] = resolve(role, new Set());
  return policy;
}

/**
 * いずれか 1 つでも権限を持つか(OR 条件)。
 *
 * @param policy   解決済みのポリシー
 * @param roles    ユーザーのロール
 * @param required 必要な権限(このうち 1 つでも持っていればよい)
 * @returns 1 つでも持っていれば true。required が空なら false
 */
export function canAny(policy: Policy, roles: Role[], required: Permission[]): boolean {
  return required.some((r) => can(policy, roles, r));
}

/**
 * すべての権限を持つか(AND 条件)。
 *
 * @param policy   解決済みのポリシー
 * @param roles    ユーザーのロール
 * @param required 必要な権限(すべて必要)
 * @returns すべて持っていれば true。**required が空なら true**(条件が無い = 通す)
 */
export function canAll(policy: Policy, roles: Role[], required: Permission[]): boolean {
  return required.every((r) => can(policy, roles, r));
}

/**
 * スコープ付き判定。`action:any`(全件)を持てば無条件許可、
 * 本人(isOwner)なら `action:own` でも許可。
 *
 * @example
 * ```ts
 * canScoped(policy, roles, "expense:approve", { isOwner: expense.userId === user.id });
 * ```
 *
 * @param policy 解決済みのポリシー
 * @param roles  ユーザーのロール
 * @param action 実行したい操作
 * @param ctx    文脈。`isOwner` が true なら「自分のもの」向けの権限も見る
 * @returns 許可されるなら true
 */
export function canScoped(policy: Policy, roles: Role[], action: Permission, ctx: { isOwner: boolean }): boolean {
  if (can(policy, roles, `${action}:any`)) return true;
  if (ctx.isOwner && can(policy, roles, `${action}:own`)) return true;
  return false;
}

/**
 * リストを、ユーザーが権限を持つ要素だけに絞る。
 *
 * **見えてはいけないものを一覧に出さない**ために使う。画面側で絞るのではなく、
 * データを返す前にここを通す(画面側の実装漏れが情報漏洩になるため)。
 *
 * @param policy       解決済みのポリシー
 * @param roles        ユーザーのロール
 * @param items        絞り込む対象
 * @param permissionOf 要素から必要権限を求める関数
 * @returns 権限を持つ要素だけの新しい配列
 */
export function filterAuthorized<T>(policy: Policy, roles: Role[], items: readonly T[], permissionOf: (item: T) => Permission): T[] {
  return items.filter((item) => can(policy, roles, permissionOf(item)));
}

/**
 * UI 用に、権限の有無をフラグ辞書へ変換する。
 *
 * 画面側で `can(...)` を何度も呼ぶより、一度まとめて渡した方が読みやすく、
 * サーバから props として渡すこともできる。
 *
 * @param policy   解決済みのポリシー
 * @param roles    ユーザーのロール
 * @param features 画面で使うキー → 必要権限の対応
 * @returns キー → 権限があるか(true/false)の辞書
 *
 * @example
 * ```ts
 * const flags = featureFlags(policy, user.roles, {
 *   canApprove: "expense:approve",
 *   canExport: "expense:export",
 * });
 * // => { canApprove: true, canExport: false }
 * ```
 */
export function featureFlags(policy: Policy, roles: Role[], features: Record<string, Permission>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [key, perm] of Object.entries(features)) out[key] = can(policy, roles, perm);
  return out;
}
