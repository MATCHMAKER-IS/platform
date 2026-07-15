import * as React from "react";
export const metadata = { title: "バックアップ" };
export default function BackupPage() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-2 text-2xl font-bold">データバックアップ</h1>
      <p className="mb-4 text-sm text-neutral-600">主要データ（請求・取引先・利用者・設定・監査ログ）を 1 つの JSON ファイルにまとめてダウンロードします。利用者のメール・氏名はマスクされます。</p>
      <a href="/api/admin/backup" className="inline-block rounded bg-neutral-900 px-6 py-2.5 text-sm text-white">バックアップをダウンロード</a>
      <p className="mt-4 text-xs text-neutral-400">定期的なバックアップは cron 等から <code>/api/admin/backup</code> を呼び出して保存してください。</p>
    </div>
  );
}
