"use client";
/**
 * ファイル一覧。名前・サイズ・種別・日時を表示し、開く/削除ボタンを出せる。画像はサムネイル表示。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { formatBytes } from "../lib/format-bytes";

/** 一覧に出すファイル項目。 */
export interface FileListItem {
  key: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  uploadedByName?: string;
  /** 表示用 URL(画像プレビュー/ダウンロード)。 */
  url?: string;
}

/** {@link FileList} の props。 */
export interface FileListProps {
  files: FileListItem[];
  onOpen?: (key: string) => void;
  onDelete?: (key: string) => void;
  className?: string;
}

function iconFor(type: string): string {
  if (type.startsWith("image/")) return "🖼️";
  if (type === "application/pdf") return "📄";
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) return "📊";
  if (type.includes("word") || type.includes("document")) return "📝";
  if (type.includes("zip") || type.includes("compressed")) return "🗜️";
  return "📎";
}

/** ファイル一覧。 */
export function FileList({ files, onOpen, onDelete, className }: FileListProps) {
  if (files.length === 0) return null;
  return (
    <ul className={cn("divide-y divide-[var(--color-border)] rounded-[var(--radius)] border border-[var(--color-border)]", className)}>
      {files.map((f) => {
        const isImage = f.type.startsWith("image/") && f.url;
        return (
          <li key={f.key} className="flex items-center gap-3 px-3 py-2">
            {isImage ? (
              <img src={f.url} alt={f.name} className="h-10 w-10 rounded object-cover" loading="lazy" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center text-xl" aria-hidden>{iconFor(f.type)}</span>
            )}
            <button className="min-w-0 flex-1 text-left" onClick={() => onOpen?.(f.key)}>
              <div className="truncate text-sm font-medium">{f.name}</div>
              <div className="text-xs text-[var(--color-muted)]">
                {formatBytes(f.size)} ・ {f.uploadedAt.slice(0, 16).replace("T", " ")}
                {f.uploadedByName ? ` ・ ${f.uploadedByName}` : ""}
              </div>
            </button>
            {onDelete && (
              <button className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger,#e11)]" onClick={() => onDelete(f.key)} aria-label="削除">
                削除
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
