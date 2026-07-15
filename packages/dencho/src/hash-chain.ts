/**
 * 改ざん検知(ハッシュチェーン)。電子帳簿保存法の「真実性の確保」に対応する。
 * 各レコードが直前のハッシュを含めてハッシュ化されるため、途中を書き換えると連鎖が壊れ、
 * 改ざんを検知できる。訂正・削除の記録を残す運用と組み合わせて使う。
 * @packageDocumentation
 */
import { createHash } from "node:crypto";

/** ハッシュチェーンの起点(genesis)ハッシュ。 */
export const GENESIS_HASH = "0".repeat(64);

/** キーを再帰的にソートした決定的 JSON 文字列を作る(同じ内容なら同じ文字列)。 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}
function sortValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === "object") {
    return Object.keys(v as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => { acc[k] = sortValue((v as Record<string, unknown>)[k]); return acc; }, {});
  }
  return v;
}

/** チェーン上の 1 レコード。 */
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

/** レコードのハッシュを計算する(seq・日時・データ・前ハッシュを連結)。 */
export function hashEvidence(seq: number, recordedAt: string, data: unknown, prevHash: string): string {
  const payload = `${seq}\u0000${recordedAt}\u0000${canonicalJson(data)}\u0000${prevHash}`;
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * チェーンに 1 件追加する(末尾のハッシュを引き継ぐ)。元の配列は変更しない。
 * @param chain 既存のチェーン(空なら genesis から)
 */
export function appendEvidence(chain: EvidenceRecord[], data: unknown, recordedAt: string): EvidenceRecord {
  const last = chain[chain.length - 1];
  const seq = last ? last.seq + 1 : 0;
  const prevHash = last ? last.hash : GENESIS_HASH;
  return { seq, recordedAt, data, prevHash, hash: hashEvidence(seq, recordedAt, data, prevHash) };
}

/** 検証結果。 */
export interface ChainVerification {
  valid: boolean;
  /** 壊れている最初のレコードの seq(valid なら undefined)。 */
  brokenAt?: number;
  /** 理由。 */
  reason?: string;
}

/**
 * チェーン全体の整合性を検証する。
 * 各レコードのハッシュ再計算・前ハッシュの連結・連番を確認し、改ざんの有無を返す。
 */
export function verifyEvidenceChain(records: EvidenceRecord[]): ChainVerification {
  let prevHash = GENESIS_HASH;
  for (let i = 0; i < records.length; i++) {
    const r = records[i]!;
    if (r.seq !== i) return { valid: false, brokenAt: r.seq, reason: `連番が不正(期待 ${i}, 実際 ${r.seq})` };
    if (r.prevHash !== prevHash) return { valid: false, brokenAt: r.seq, reason: "前ハッシュの連結が不正(順序変更・欠落の可能性)" };
    const expected = hashEvidence(r.seq, r.recordedAt, r.data, r.prevHash);
    if (r.hash !== expected) return { valid: false, brokenAt: r.seq, reason: "ハッシュ不一致(データが改ざんされた可能性)" };
    prevHash = r.hash;
  }
  return { valid: true };
}
