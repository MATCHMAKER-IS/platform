"use client";
/**
 * 添付ファイルの一覧表示。画像はサムネイル、その他はファイル名チップ。chat/board 非依存。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** 表示用の添付情報。 */
export interface AttachmentItem {
  key: string;
  name: string;
  size: number;
  type: string;
  /** 表示/ダウンロード用 URL(呼び出し側で storage キーから解決)。 */
  url?: string;
  /** サムネイル URL(画像グリッド用・thumbnailKey から解決)。 */
  thumbnailUrl?: string;
}

/** {@link AttachmentList} の props。 */
export interface AttachmentListProps {
  attachments: AttachmentItem[];
  /** クリック時(ダウンロード等)。 */
  onOpen?: (item: AttachmentItem) => void;
  className?: string;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 添付一覧(画像サムネ + ファイルチップ)。 */
/**
 * 添付ファイルの表示。
 *
 * 画像は縮小版を、それ以外は種類の絵柄を出す。
 * **開く前に危険なファイル**(実行形式)は、その旨を示す。
 */
export function AttachmentList({ attachments, onOpen, className }: AttachmentListProps) {
  if (attachments.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {attachments.map((a) => {
        const isImage = a.type.startsWith("image/");
        if (isImage && (a.thumbnailUrl ?? a.url)) {
          return (
            <button key={a.key} className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]" onClick={() => onOpen?.(a)} title={a.name}>
              <img src={a.thumbnailUrl ?? a.url} alt={a.name} className="h-24 w-24 object-cover" loading="lazy" />
            </button>
          );
        }
        return (
          <button
            key={a.key}
            className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2 text-left text-sm hover:bg-[var(--color-muted-bg,#f5f5f5)]"
            onClick={() => onOpen?.(a)}
          >
            <span aria-hidden className="text-[var(--color-muted)]">{isImage ? "🖼️" : "📎"}</span>
            <span className="flex flex-col">
              <span className="max-w-[180px] truncate">{a.name}</span>
              <span className="text-xs text-[var(--color-muted)]">{humanSize(a.size)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
