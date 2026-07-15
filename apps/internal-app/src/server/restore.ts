/**
 * バックアップ復元/インポート。buildBackup が出力した JSON バンドルを検証し、データセット単位で適用する。
 * 安全なデータセット（設定・取引先など冪等な upsert）のみ適用し、それ以外はプレビュー扱いにする。純ロジック＋適用ディスパッチ。
 * @packageDocumentation
 */
import { type BackupBundle } from "./backup.js";

/** パース結果。 */
export interface ParseResult {
  ok: boolean;
  bundle?: BackupBundle;
  error?: string;
}

/** JSON 文字列をバックアップバンドルとして検証・解析する。 */
export function parseBackupBundle(text: string): ParseResult {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false, error: "JSON として解析できません" };
  }
  const b = obj as Partial<BackupBundle>;
  if (typeof b.app !== "string" || typeof b.version !== "number" || !Array.isArray(b.datasets)) {
    return { ok: false, error: "バックアップ形式ではありません（app/version/datasets が必要）" };
  }
  for (const d of b.datasets) {
    if (typeof d.name !== "string" || !Array.isArray(d.records)) return { ok: false, error: `データセット形式が不正です: ${String((d as { name?: unknown }).name)}` };
  }
  return { ok: true, bundle: obj as BackupBundle };
}

/** 復元計画（各データセットの件数と、適用可能か）。 */
export interface RestorePlanItem {
  name: string;
  count: number;
  restorable: boolean;
}

/** 適用可能なデータセット（冪等 upsert が用意されているもの）。 */
export const RESTORABLE_DATASETS = ["partners", "settings"] as const;

/** バンドルから復元計画を作る。 */
export function restorePlan(bundle: BackupBundle): RestorePlanItem[] {
  const restorable = new Set<string>(RESTORABLE_DATASETS);
  return bundle.datasets.map((d) => ({ name: d.name, count: d.records.length, restorable: restorable.has(d.name) }));
}

/** データセット名 → 適用関数。 */
export type Appliers = Record<string, (records: unknown[]) => Promise<number>>;

/** 適用結果。 */
export interface RestoreResult {
  dryRun: boolean;
  applied: { name: string; count: number }[];
  skipped: { name: string; reason: string }[];
}

/**
 * バンドルを適用する。dryRun 時は件数のみ算出。適用関数が無い/対象外のデータセットは skipped に記録。
 */
export async function applyRestore(bundle: BackupBundle, appliers: Appliers, options: { dryRun?: boolean } = {}): Promise<RestoreResult> {
  const dryRun = options.dryRun ?? false;
  const restorable = new Set<string>(RESTORABLE_DATASETS);
  const applied: { name: string; count: number }[] = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const d of bundle.datasets) {
    if (!restorable.has(d.name)) {
      skipped.push({ name: d.name, reason: "復元対象外（安全のため）" });
      continue;
    }
    if (dryRun) {
      // プレビュー: 適用関数の有無に関わらず件数を示す
      applied.push({ name: d.name, count: d.records.length });
      continue;
    }
    const applier = appliers[d.name];
    if (!applier) {
      skipped.push({ name: d.name, reason: "適用処理が未登録" });
      continue;
    }
    applied.push({ name: d.name, count: await applier(d.records) });
  }
  return { dryRun, applied, skipped };
}
