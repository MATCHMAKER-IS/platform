"use client";
/**
 * ブロックエディタ。ページのブロック（見出し/本文/画像/リスト/CTA）を追加・編集・並べ替え・削除する。
 * 並べ替えロジックは @platform/site の reorder を使う想定だが、UI 内では上下移動で完結。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { SortableList } from "./sortable-list";

/** 編集対象のブロック。 */
export interface EditableBlock {
  id: string;
  type: "heading" | "text" | "image" | "list" | "cta" | "gallery" | "embed";
  data: Record<string, unknown>;
}

/** {@link BlockEditor} の props。 */
export interface BlockEditorProps {
  blocks: EditableBlock[];
  onChange: (blocks: EditableBlock[]) => void;
  className?: string;
}

const BLOCK_LABELS: Record<EditableBlock["type"], string> = { heading: "見出し", text: "本文", image: "画像", list: "リスト", cta: "CTA", gallery: "ギャラリー", embed: "埋め込み" };

function newBlock(type: EditableBlock["type"]): EditableBlock {
  const id = `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const data: Record<string, unknown> =
    type === "heading" ? { level: 2, text: "" }
      : type === "list" ? { items: [] }
      : type === "cta" ? { label: "", href: "" }
      : type === "image" ? { src: "", alt: "" }
      : type === "gallery" ? { images: [] }
      : type === "embed" ? { src: "", html: "" }
      : { text: "" };
  return { id, type, data };
}

/** ブロックエディタ。 */
export function BlockEditor({ blocks, onChange, className }: BlockEditorProps) {
  const update = (i: number, data: Record<string, unknown>) => onChange(blocks.map((b, j) => (j === i ? { ...b, data } : b)));
  const remove = (i: number) => onChange(blocks.filter((_, j) => j !== i));
  const add = (type: EditableBlock["type"]) => onChange([...blocks, newBlock(type)]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <SortableList
        items={blocks}
        getKey={(b) => b.id}
        onReorder={onChange}
        renderItem={(b, i) => (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-muted)]">{BLOCK_LABELS[b.type]}</span>
            <div className="flex gap-1">
              <button type="button" onClick={() => remove(i)} className="px-1 text-sm text-[var(--color-danger-fg,#dc2626)]" aria-label="削除">×</button>
            </div>
          </div>
          {b.type === "heading" && (
            <div className="flex gap-2">
              <select value={String(b.data.level ?? 2)} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update(i, { ...b.data, level: Number(e.target.value) })} className="rounded border border-[var(--color-border)] px-2 py-1 text-sm">
                {[1, 2, 3].map((l) => <option key={l} value={l}>H{l}</option>)}
              </select>
              <input value={String(b.data.text ?? "")} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(i, { ...b.data, text: e.target.value })} placeholder="見出しテキスト" className="flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
            </div>
          )}
          {b.type === "text" && (
            <textarea value={String(b.data.text ?? "")} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update(i, { ...b.data, text: e.target.value })} placeholder="本文（改行可・URL は自動リンク）" rows={4} className="w-full rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
          )}
          {b.type === "image" && (
            <div className="flex flex-col gap-2">
              <input value={String(b.data.src ?? "")} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(i, { ...b.data, src: e.target.value })} placeholder="画像 URL" className="rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
              <input value={String(b.data.alt ?? "")} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(i, { ...b.data, alt: e.target.value })} placeholder="代替テキスト" className="rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
            </div>
          )}
          {b.type === "list" && (
            <textarea
              value={(Array.isArray(b.data.items) ? (b.data.items as string[]) : []).join("\n")}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update(i, { ...b.data, items: e.target.value.split("\n").filter((x) => x.length > 0) })}
              placeholder="1 行 1 項目"
              rows={3}
              className="w-full rounded border border-[var(--color-border)] px-2 py-1 text-sm"
            />
          )}
          {b.type === "cta" && (
            <div className="flex gap-2">
              <input value={String(b.data.label ?? "")} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(i, { ...b.data, label: e.target.value })} placeholder="ボタン文言" className="flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
              <input value={String(b.data.href ?? "")} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(i, { ...b.data, href: e.target.value })} placeholder="リンク先" className="flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
            </div>
          )}
          {b.type === "gallery" && (
            <textarea
              value={(Array.isArray(b.data.images) ? (b.data.images as { src?: string }[]) : []).map((im) => im.src ?? "").join("\n")}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update(i, { ...b.data, images: e.target.value.split("\n").filter((x) => x.length > 0).map((src) => ({ src, alt: "" })) })}
              placeholder="画像 URL を 1 行 1 枚"
              rows={4}
              className="w-full rounded border border-[var(--color-border)] px-2 py-1 text-sm"
            />
          )}
          {b.type === "embed" && (
            <div className="flex flex-col gap-2">
              <input value={String(b.data.src ?? "")} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(i, { ...b.data, src: e.target.value })} placeholder="iframe の URL（YouTube・地図など）" className="rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
              <textarea value={String(b.data.html ?? "")} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update(i, { ...b.data, html: e.target.value })} placeholder="または生 HTML（計測タグなど・信頼できるもののみ）" rows={3} className="w-full rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
            </div>
          )}
        </div>
        )}
      />
      <div className="flex flex-wrap gap-2">
        {(Object.keys(BLOCK_LABELS) as EditableBlock["type"][]).map((t) => (
          <button key={t} type="button" onClick={() => add(t)} className="rounded border border-dashed border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
            + {BLOCK_LABELS[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
