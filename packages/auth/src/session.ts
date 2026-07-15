/**
 * 認証済みユーザー・セッションの共通型と、権限確認ヘルパー。
 * SSO(OIDC)そのものの実装はアプリ側(Auth.js 等)が担い、
 * ここでは「認証済みの状態をどう表現し、どう権限判定するか」を共通化する。
 *
 * @packageDocumentation
 */

import { AppError, ErrorCode } from "@platform/core";
import { can, type Permission, type Policy, type Role } from "./rbac.js";

/** 認証済みユーザー。 */
export interface AuthUser {
  /** 一意なユーザー ID(IdP の sub 等)。 */
  id: string;
  /** 表示名。 */
  name?: string;
  /** メールアドレス。 */
  email?: string;
  /** 付与されたロール。 */
  roles: Role[];
}

/** セッション。 */
export interface Session {
  user: AuthUser;
  /** 有効期限(UNIX ミリ秒)。 */
  expiresAt: number;
}

/**
 * ユーザーが必要な権限を持つことを表明する(ガード)。
 * 権限が無ければ `FORBIDDEN` の {@link @platform/core#AppError} を throw する。
 *
 * @param policy   ポリシー
 * @param user     対象ユーザー
 * @param required 必要な権限
 * @throws {@link @platform/core#AppError} コード `FORBIDDEN`
 *
 * @example
 * ```ts
 * assertCan(policy, session.user, "invoice:approve");
 * // ここに来たら権限あり
 * ```
 */
export function assertCan(policy: Policy, user: AuthUser, required: Permission): void {
  if (!can(policy, user.roles, required)) {
    throw new AppError(ErrorCode.FORBIDDEN, "この操作を行う権限がありません", {
      details: { required, roles: user.roles },
    });
  }
}
