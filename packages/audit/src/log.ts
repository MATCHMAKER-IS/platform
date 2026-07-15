/**
 * 監査ログ(追記専用 + ハッシュチェーンによる改ざん検知。純ロジック)。
 * 各エントリは直前エントリのハッシュを取り込むため、途中の改ざんは検知できる。
 * ハッシュ関数は注入可能(既定は依存なしの FNV-1a。運用では sha256 を渡すとよい)。
 * @packageDocumentation
 */
import { type AuditEvent } from "./event.js";

/** ログの 1 エントリ(イベント + チェーン情報)。 */
export interface AuditEntry extends AuditEvent {
  /** 連番(0 始まり)。 */
  seq: number;
  /** 直前エントリのハッシュ("" は先頭)。 */
  prevHash: string;
  /** このエントリのハッシュ。 */
  hash: string;
}

/** ハッシュ関数の型。 */
export type HashFn = (input: string) => string;

/** 依存なしの既定ハッシュ(FNV-1a 32bit・16進)。運用では sha256 を注入推奨。 */
export const fnv1a: HashFn = (input) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
};

/** イベントを正規化した文字列(ハッシュ対象)。キー順を固定する。 */
function canonical(event: AuditEvent): string {
  return JSON.stringify({ at: event.at, actor: event.actor, action: event.action, target: event.target, before: event.before ?? null, after: event.after ?? null, meta: event.meta ?? null });
}

/** ログにイベントを追記する(新しい配列を返す。ハッシュチェーンを更新)。 */
export function appendEvent(log: AuditEntry[], event: AuditEvent, hashFn: HashFn = fnv1a): AuditEntry[] {
  const prev = log[log.length - 1];
  const prevHash = prev ? prev.hash : "";
  const seq = prev ? prev.seq + 1 : 0;
  const hash = hashFn(`${prevHash}|${seq}|${canonical(event)}`);
  return [...log, { ...event, seq, prevHash, hash }];
}

/** 複数イベントをまとめて追記する。 */
export function appendAll(log: AuditEntry[], events: AuditEvent[], hashFn: HashFn = fnv1a): AuditEntry[] {
  return events.reduce((acc, e) => appendEvent(acc, e, hashFn), log);
}

/** チェーンの検証結果。 */
export interface ChainVerification {
  valid: boolean;
  /** 最初に壊れたエントリの seq(なければ null)。 */
  brokenAt: number | null;
}

/** ハッシュチェーンを検証し、改ざん(値の書換え・削除・並べ替え)を検知する。 */
export function verifyChain(log: AuditEntry[], hashFn: HashFn = fnv1a): ChainVerification {
  let prevHash = "";
  for (let i = 0; i < log.length; i++) {
    const entry = log[i]!;
    if (entry.seq !== i || entry.prevHash !== prevHash) return { valid: false, brokenAt: entry.seq };
    const expected = hashFn(`${prevHash}|${entry.seq}|${canonical(entry)}`);
    if (expected !== entry.hash) return { valid: false, brokenAt: entry.seq };
    prevHash = entry.hash;
  }
  return { valid: true, brokenAt: null };
}
