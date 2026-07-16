"use client";
/**
 * 掲示板の投稿カード。投稿者・本文・リアクション・返信数を表示。board パッケージ非依存。
 * @packageDocumentation
 */
import * as React from "react";
import { linkify } from "@platform/html";
import { cn } from "../lib/cn";

/** リアクションの表示単位。 */
export interface ReactionCount {
  kind: string;
  count: number;
  /** 自分が押しているか。 */
  reacted?: boolean;
}

/** {@link PostCard} の props。 */
export interface PostCardProps {
  authorName: string;
  body: string;
  /** URL を自動リンク化する（既定 true・XSS 安全）。 */
  renderLinks?: boolean;
  timestamp?: string;
  edited?: boolean;
  reactions?: ReactionCount[];
  /** 返信数(スレッド本文で表示)。 */
  replyCount?: number;
  onReact?: (kind: string) => void;
  onReply?: () => void;
  className?: string;
}

const REACTION_LABEL: Record<string, string> = { like: "👍", eyes: "👀", heart: "❤️", check: "✅" };

/** 投稿カード。 */
export function PostCard({ authorName, body, timestamp, edited, reactions = [], replyCount, onReact, onReply, renderLinks = true, className }: PostCardProps) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--color-border)] p-4", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{authorName}</span>
        <span className="text-xs text-[var(--color-muted)]">{timestamp}{edited ? "（編集済み）" : ""}</span>
      </div>
      {renderLinks ? (
        <p className="text-sm whitespace-pre-wrap break-words [&_a]:underline" dangerouslySetInnerHTML={{ __html: linkify(body) }} />
      ) : (
        <p className="text-sm whitespace-pre-wrap break-words">{body}</p>
      )}
      <div className="flex items-center gap-2">
        {reactions.map((r) => (
          <button
            key={r.kind}
            className={cn("rounded-full border px-2 py-0.5 text-xs", r.reacted ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10" : "border-[var(--color-border)]")}
            onClick={() => onReact?.(r.kind)}
          >
            {REACTION_LABEL[r.kind] ?? r.kind} {r.count}
          </button>
        ))}
        {onReact && (
          <button className="rounded-full border border-dashed border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-muted)]" onClick={() => onReact("like")}>
            + リアクション
          </button>
        )}
        {replyCount !== undefined && onReply && (
          <button className="ml-auto text-xs text-[var(--color-primary)]" onClick={onReply}>
            返信 {replyCount}件
          </button>
        )}
      </div>
    </div>
  );
}
