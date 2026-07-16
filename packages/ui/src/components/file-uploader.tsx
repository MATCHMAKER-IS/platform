"use client";
/**
 * 共通 FileUploader。ファイル選択(ドラッグ&ドロップ)→自動アップロード→進捗表示を
 * ひとまとめにしたコンポーネント。保存後のキー等は onUploaded で受け取る。
 * @packageDocumentation
 */
import * as React from "react";
import { FileUpload } from "./file-upload";
import { Progress } from "./progress";
import { useUpload } from "./use-upload";
import { cn } from "../lib/cn";

/** {@link FileUploader} の props。 */
export interface FileUploaderProps {
  /** アップロード先 URL。 */
  url: string;
  /** 追加ヘッダ(CSRF 等)。 */
  headers?: Record<string, string>;
  accept?: string;
  multiple?: boolean;
  hint?: string;
  /** アップロード完了時(サーバ応答 data)。 */
  onUploaded?: (data: unknown) => void;
  className?: string;
}

/** 選択即アップロード + 進捗表示のアップローダー。 */
export function FileUploader({ url, headers, accept, multiple, hint, onUploaded, className }: FileUploaderProps) {
  const { upload, progress, uploading } = useUpload({ url, headers });
  const [error, setError] = React.useState<string | null>(null);

  const onFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError(null);
    const res = await upload(files);
    if (res.ok) onUploaded?.(res.data);
    else setError((res.data as { error?: { message?: string } })?.error?.message ?? res.error ?? "アップロードに失敗しました");
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <FileUpload accept={accept} multiple={multiple} hint={hint} onFilesChange={onFiles} />
      {uploading && <Progress value={progress} />}
      {error && <span className="text-sm text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
