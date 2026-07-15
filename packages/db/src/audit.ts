/**
 * 監査ログ(誰が・いつ・何をしたか)の書き込みヘルパー。
 * `schema.prisma` の `AuditLog` モデルに 1 件記録する。
 *
 * @packageDocumentation
 */

import type { PrismaClient } from "@prisma/client";
import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";

/** 監査ログ 1 件分の入力。 */
export interface AuditEntry {
  /** 操作者(ユーザー ID / メール等)。 */
  actor: string;
  /** 操作内容(例: "user.create"）。 */
  action: string;
  /** 操作対象の識別子(任意)。 */
  target?: string;
  /** 付随情報(個人情報や機微情報は入れない)。 */
  metadata?: Record<string, unknown>;
}

/**
 * 監査ログを 1 件記録する。
 *
 * @param db    PrismaClient
 * @param entry 記録内容
 * @returns 成功なら `ok`、失敗なら `DATABASE` の `err`
 *
 * @example
 * ```ts
 * await recordAudit(db, {
 *   actor: session.userId,
 *   action: "invoice.approve",
 *   target: invoiceId,
 * });
 * ```
 */
export async function recordAudit(
  db: PrismaClient,
  entry: AuditEntry,
): Promise<Result<void>> {
  const res = await tryCatch(async () => {
    await db.auditLog.create({
      data: {
        actor: entry.actor,
        action: entry.action,
        target: entry.target ?? null,
        metadata: (entry.metadata ?? undefined) as never,
      },
    });
  });
  if (res.ok) return res;
  return {
    ok: false,
    error: new AppError(ErrorCode.DATABASE, "監査ログの記録に失敗しました", {
      cause: res.error.cause ?? res.error,
    }),
  };
}

import { diffChanges, hasChanges, type DiffOptions } from "./audit-diff.js";

/** {@link recordAuditChange} の入力。 */
export interface AuditChangeEntry extends DiffOptions {
  actor: string;
  action: string;
  target?: string;
  /** 変更前の状態。 */
  before: Record<string, unknown> | null | undefined;
  /** 変更後の状態。 */
  after: Record<string, unknown> | null | undefined;
}

/**
 * 変更差分付きで監査ログを記録する。metadata.changes に変わったフィールドのみ残す。
 * 変更が無い場合も記録する(no-op を明示したくない場合は呼び出し側で判定)。
 *
 * @example
 * ```ts
 * await recordAuditChange(db, {
 *   actor: session.userId, action: "user.update", target: user.id,
 *   before: oldUser, after: newUser, ignore: ["updatedAt"], redact: ["passwordHash"],
 * });
 * ```
 */
export async function recordAuditChange(db: PrismaClient, entry: AuditChangeEntry): Promise<Result<void>> {
  const changes = diffChanges(entry.before, entry.after, { ignore: entry.ignore, redact: entry.redact });
  return recordAudit(db, {
    actor: entry.actor,
    action: entry.action,
    target: entry.target,
    metadata: { changes, changed: hasChanges(changes) },
  });
}
