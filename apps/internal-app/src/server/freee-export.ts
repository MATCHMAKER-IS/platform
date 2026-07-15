/**
 * freee 会計連携（アプリ側の組み合わせ）。仕訳を freee の複式簿記ペイロードへ変換する。
 * 変換・冪等キー・バッチ化は @platform/accounting に委譲する。実送信は行わない（プレビュー）。
 * @packageDocumentation
 */
import { prepareBatch, type PreparedBatch, type JournalEntry } from "@platform/accounting";

/**
 * 既定の勘定科目 → freee 勘定科目 ID の対応表。
 * 実運用では freee の勘定科目一覧（account_items）から取得した ID に置き換える。
 */
export const DEFAULT_FREEE_ACCOUNT_IDS: Record<string, number> = {
  売掛金: 101,
  売上高: 201,
  仮受消費税: 202,
  現金預金: 102,
  仕入高: 301,
  仮払消費税: 302,
  買掛金: 401,
};

/** freee 送信用のバッチを作る。未登録科目がある仕訳は errors に振り分けられる。 */
export function freeeBatch(entries: JournalEntry[], accountIds: Record<string, number> = DEFAULT_FREEE_ACCOUNT_IDS): PreparedBatch {
  return prepareBatch(entries, accountIds);
}

/** バッチの集計（送信可能件数・要修正件数）。 */
export function freeeBatchSummary(batch: PreparedBatch): { total: number; ready: number; errors: number } {
  return { total: batch.ready.length + batch.errors.length, ready: batch.ready.length, errors: batch.errors.length };
}
