"use client";
/**
 * ファイルアップロードの完成テンプレート。
 * @platform/ui の FileUpload(ドロップ選択)+ useUpload(進捗付き送信)+ Progress を束ね、
 * クライアント側の種類/サイズ検証、ファイル一覧、完了トーストまでをまとめる。
 * @packageDocumentation
 */
import * as React from "react";
import { FileUpload, useUpload, Progress, Button, toast } from "@platform/ui";

/** {@link UploadPanel} の props。 */
export interface UploadPanelProps {
  /** 送信先 URL。 */
  url: string;
  /** 受け付ける MIME/拡張子。 */
  accept?: string;
  /** 最大サイズ(バイト)。既定 10MB。 */
  maxSize?: number;
  /** 追加ヘッダ(CSRF 等)。 */
  headers?: Record<string, string>;
}

const DEFAULT_MAX = 10 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** ドロップ選択 → 検証 → 進捗付き送信のアップロードパネル。 */
export function UploadPanel({ url, accept, maxSize = DEFAULT_MAX, headers }: UploadPanelProps) {
  const [files, setFiles] = React.useState<File[]>([]);
  const { progress, uploading, upload } = useUpload({ url, headers });

  function onFilesChange(selected: File[]) {
    // クライアント側の検証(サイズ超過を弾く)
    const tooBig = selected.filter((f) => f.size > maxSize);
    if (tooBig.length > 0) {
      toast.error(`サイズ超過: ${tooBig.map((f) => f.name).join(", ")}（上限 ${formatSize(maxSize)}）`);
    }
    setFiles(selected.filter((f) => f.size <= maxSize));
  }

  async function handleUpload() {
    if (files.length === 0) return;
    const result = await upload(files);
    if (result.ok) {
      toast.success(`${files.length} 件のアップロードが完了しました`);
      setFiles([]);
    } else {
      toast.error(result.error ?? "アップロードに失敗しました");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FileUpload accept={accept} multiple onFilesChange={onFilesChange} hint={`最大 ${formatSize(maxSize)}`} />

      {files.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2">
              <span className="truncate">{f.name}</span>
              <span className="ml-2 shrink-0 text-[var(--color-muted)]">{formatSize(f.size)}</span>
            </li>
          ))}
        </ul>
      )}

      {uploading && <Progress value={progress} />}

      <Button onClick={handleUpload} disabled={files.length === 0 || uploading}>
        {uploading ? `アップロード中… ${progress}%` : `${files.length} 件をアップロード`}
      </Button>
    </div>
  );
}
