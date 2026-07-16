/**
 * テスト用ファクトリ。ユーザー・セッション・ID・日時のダミーを一貫した形で作る。
 * テストごとに手書きするのをやめ、表記ゆれと重複を防ぐ。
 * @packageDocumentation
 */
import type { AuthUser, Session } from "@platform/auth";

let counter = 0;

/**
 * 連番付きのテスト用 ID を作る。
 *
 *
 * @param prefix 接頭辞
 * @returns テスト用の ID(**連番なので再現できる**。ランダムだとテストが不安定になる)
 */
export function testId(prefix = "id"): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/**
 * 認証済みユーザーのダミーを作る。
 *
 *
 * @param overrides 上書きする値
 * @returns テスト用のユーザー
 */
export function fakeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: overrides.id ?? testId("user"),
    name: overrides.name ?? "テスト太郎",
    email: overrides.email ?? "test@example.co.jp",
    roles: overrides.roles ?? ["staff"],
  };
}

/**
 * セッションのダミーを作る。
 *
 *
 * @param overrides 上書きする値
 * @returns テスト用のセッション
 */
export function fakeSession(overrides: Partial<Session> = {}): Session {
  return {
    user: overrides.user ?? fakeAuthUser(),
    expiresAt: overrides.expiresAt ?? Date.now() + 60 * 60 * 1000,
  };
}

/**
 * テストで固定した日時を返す(既定: 2026-01-01T00:00:00Z)。
 *
 *
 * @param iso ISO 文字列
 * @returns 固定の日時(**テストで `new Date()` を使わない**。実行のたびに変わると再現できない)
 */
export function fixedDate(iso = "2026-01-01T00:00:00.000Z"): Date {
  return new Date(iso);
}
