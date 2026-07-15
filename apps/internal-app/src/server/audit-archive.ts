/**
 * 監査ログのアーカイブ。指定日以前のエントリを整合性チェックサム付きで書き出し、長期保管する。
 * 監査はハッシュチェーンのため、中間削除はチェーンを壊す。ここでは「エクスポート（バウンドされた範囲＋チェックサム）」を提供し、破壊的な削除は行わない。
 * @packageDocumentation
 */

/** アーカイブ対象の監査行（必要部分）。 */
export interface AuditRowLike {
  seq: number;
  at: string;
  actor: string;
  action: string;
  target?: string;
}

/** 指定 ISO 日時（含む）以前のエントリを選ぶ（アーカイブ対象）。 */
export function selectForArchive<T extends { at: string }>(rows: T[], beforeIso: string): T[] {
  return rows.filter((r) => r.at <= beforeIso);
}

/** 決定的なチェックサム（順序付き seq+at の FNV-1a 16進）。改ざん検知の簡易版。 */
export function archiveChecksum(rows: AuditRowLike[]): string {
  const input = rows.slice().sort((a, b) => a.seq - b.seq).map((r) => `${r.seq}|${r.at}|${r.action}`).join("\n");
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** アーカイブバンドル。 */
export interface AuditArchive {
  kind: "audit-archive";
  version: number;
  generatedAt: string;
  cutoff: string;
  count: number;
  seqRange: { from: number; to: number } | null;
  checksum: string;
  entries: AuditRowLike[];
}

/** 指定日以前のエントリからアーカイブを組み立てる。 */
export function buildAuditArchive(rows: AuditRowLike[], cutoffIso: string, now: Date): AuditArchive {
  const selected = selectForArchive(rows, cutoffIso).slice().sort((a, b) => a.seq - b.seq);
  const seqRange = selected.length > 0 ? { from: selected[0]!.seq, to: selected[selected.length - 1]!.seq } : null;
  return {
    kind: "audit-archive",
    version: 1,
    generatedAt: now.toISOString(),
    cutoff: cutoffIso,
    count: selected.length,
    seqRange,
    checksum: archiveChecksum(selected),
    entries: selected,
  };
}

/** アーカイブのファイル名。 */
export function auditArchiveFilename(cutoffIso: string): string {
  return `audit-archive-until-${cutoffIso.slice(0, 10)}.json`;
}
