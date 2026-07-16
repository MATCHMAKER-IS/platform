/**
 * 監査ログ(追記専用 + ハッシュチェーンによる改ざん検知。純ロジック)。
 * 各エントリは直前エントリのハッシュを取り込むため、途中の改ざんは検知できる。
 * ハッシュ関数は注入可能(既定は依存なしの FNV-1a。運用では sha256 を渡すとよい)。
 * @packageDocumentation
 */
import { type AuditEvent } from "./event";

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

/**
 * 監査ログにイベントを追記する。
 *
 * **ハッシュチェーンを更新する**ので、後から途中を書き換えると検出できる。
 *
 * @param log 既存のログ
 * @param event 追記するイベント
 * @returns 追記した**新しい配列**(元は変更しない)
 */
export function appendEvent(log: AuditEntry[], event: AuditEvent, hashFn: HashFn = fnv1a): AuditEntry[] {
  const prev = log[log.length - 1];
  const prevHash = prev ? prev.hash : "";
  const seq = prev ? prev.seq + 1 : 0;
  const hash = hashFn(`${prevHash}|${seq}|${canonical(event)}`);
  return [...log, { ...event, seq, prevHash, hash }];
}

/**
 * 複数のイベントをまとめて追記する。
 *
 * @param log 既存のログ
 * @param events 追記するイベント
 * @returns 追記した新しい配列
 */
export function appendAll(log: AuditEntry[], events: AuditEvent[], hashFn: HashFn = fnv1a): AuditEntry[] {
  return events.reduce((acc, e) => appendEvent(acc, e, hashFn), log);
}

/** チェーンの検証結果。 */
export interface ChainVerification {
  valid: boolean;
  /** 最初に壊れたエントリの seq(なければ null)。 */
  brokenAt: number | null;
}

/**
 * ハッシュチェーンを検証する。
 *
 * **値の書き換え・削除・並べ替えのすべてを検知できる**
 * (各レコードが前のハッシュを含むため、1 つ変えると以降がすべて合わなくなる)。
 *
 * **定期的に実行すること**。改ざんは早く見つけるほど被害が小さい。
 *
 * @param log 監査ログ
 * @returns 正しければ true と、**壊れている位置**
 */
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
