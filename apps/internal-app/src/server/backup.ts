/**
 * 統合バックアップ/データエクスポート。主要データを 1 つの JSON バンドルにまとめる。純粋な組み立てのみ。
 * @packageDocumentation
 */

/** バックアップに含める 1 データセット。 */
export interface Dataset {
  name: string;
  records: unknown[];
}

/** バックアップバンドル。 */
export interface BackupBundle {
  app: string;
  version: number;
  generatedAt: string;
  datasets: { name: string; count: number; records: unknown[] }[];
  totalRecords: number;
}

/** データセット群からバックアップバンドルを組み立てる。 */
export function buildBackup(datasets: Dataset[], now: Date, app = "internal-app"): BackupBundle {
  const ds = datasets.map((d) => ({ name: d.name, count: d.records.length, records: d.records }));
  return {
    app,
    version: 1,
    generatedAt: now.toISOString(),
    datasets: ds,
    totalRecords: ds.reduce((sum, d) => sum + d.count, 0),
  };
}

/** バンドルの目録（含まれるデータセットと件数）を返す。 */
export function backupManifest(bundle: BackupBundle): { name: string; count: number }[] {
  return bundle.datasets.map((d) => ({ name: d.name, count: d.count }));
}

/** ダウンロード用のファイル名（日付入り）。 */
export function backupFilename(now: Date, app = "internal-app"): string {
  const d = now.toISOString().slice(0, 10);
  return `backup-${app}-${d}.json`;
}
