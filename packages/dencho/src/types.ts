/**
 * 電子帳簿保存法まわりの**型だけ**。
 *
 * **依存を持ちません。** ハッシュ連鎖の実装（`hash-chain.ts`）は
 * `node:crypto` を使うので、**型を使いたいだけの画面**が
 * そちらを巻き込まないように分けてあります（2026-08）。
 *
 * @packageDocumentation
 */

/** 証拠の連鎖 1 件。 */
export interface EvidenceRecord {
  /** 連番(0 起点)。 */
  seq: number;
  /** 記録日時(ISO 8601)。 */
  recordedAt: string;
  /** 対象データ(取引データや書類のハッシュなど)。 */
  data: unknown;
  /** 直前レコードのハッシュ。 */
  prevHash: string;
  /** このレコードのハッシュ。 */
  hash: string;
}
