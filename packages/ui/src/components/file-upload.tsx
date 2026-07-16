"use client";
/**
 * 共通 FileUpload。クリックまたはドラッグ&ドロップでファイルを選択する。
 * 選択結果は onFilesChange で受け取る(検証は @platform/validation の
 * fileConstraints と組み合わせる)。アップロード自体はアプリ側で行う。
 * @packageDocumentation
 */
import * as React from "react";
import { Upload, X } from "lucide-react";
import { cn } from "../lib/cn";
import { useT } from "./i18n-provider";

/** {@link FileUpload} の props。 */
export interface FileUploadProps {
  /** 選択が変わったときに呼ばれる。 */
  onFilesChange?: (files: File[]) => void;
  /** 受け付ける MIME/拡張子(input accept と同じ)。 */
  accept?: string;
  /** 複数選択を許可するか。 */
  multiple?: boolean;
  /** 補助テキスト。 */
  hint?: string;
  className?: string;
}

/** バイト数を読みやすい単位に整形する。 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * ドラッグ&ドロップ対応ファイルアップローダー。
 * @example
 * ```tsx
 * <FileUpload accept="image/*" multiple onFilesChange={setFiles} hint="画像を選択" />
 * ```
 */
export function FileUpload({ onFilesChange, accept, multiple = false, hint, className }: FileUploadProps) {
  const t = useT();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [dragging, setDragging] = React.useState(false);

  const update = (list: FileList | null) => {
    if (!list) return;
    const next = multiple ? [...files, ...Array.from(list)] : Array.from(list).slice(0, 1);
    setFiles(next);
    onFilesChange?.(next);
  };

  const remove = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    onFilesChange?.(next);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); update(e.dataTransfer.files); }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--radius)] border-2 border-dashed p-6 text-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
          dragging ? "border-[var(--color-primary)] bg-teal-50" : "border-[var(--color-border)]",
        )}
      >
        <Upload className="h-6 w-6 text-[var(--color-muted)]" />
        <span className="text-[var(--color-fg)]">{t("upload.dropzone")}</span>
        {hint && <span className="text-xs text-[var(--color-muted)]">{hint}</span>}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => update(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-[calc(var(--radius)-2px)] border border-[var(--color-border)] px-3 py-1.5 text-sm">
              <span className="truncate">{f.name}</span>
              <span className="flex items-center gap-2 text-[var(--color-muted)]">
                {formatSize(f.size)}
                <button type="button" onClick={() => remove(i)} aria-label={t("common.delete")} className="hover:text-[var(--color-danger)]">
                  <X className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
