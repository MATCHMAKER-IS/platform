"use client";
/**
 * 共通 RichTextEditor(TipTap ラッパー)。
 * 太字・取り消し線・文字色・文字サイズの変更に対応した軽量エディタ。
 * @packageDocumentation
 */
import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Bold, Strikethrough } from "lucide-react";
import { cn } from "../lib/cn";
import { useT } from "./i18n-provider";

/** textStyle に fontSize 属性を足す最小拡張(TipTap 標準にサイズ変更が無いため)。 */
const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontSize || null,
            renderHTML: (attrs: { fontSize?: string | null }) =>
              attrs.fontSize ? { style: `font-size:${attrs.fontSize}` } : {},
          },
        },
      },
    ];
  },
});

/** {@link RichTextEditor} の props。 */
export interface RichTextEditorProps {
  /** 初期 HTML。 */
  value?: string;
  /** 内容が変わったとき(HTML 文字列)。 */
  onChange?: (html: string) => void;
  className?: string;
}

const SIZES: { label: string; value: string }[] = [
  { label: "小", value: "0.85em" },
  { label: "標準", value: "1em" },
  { label: "大", value: "1.35em" },
  { label: "特大", value: "1.75em" },
];
const COLORS = ["#0f172a", "#dc2626", "#0f766e", "#2563eb", "#d97706"];

/** 太字・取り消し線・文字色・サイズ変更に対応したリッチテキストエディタ。 */
export function RichTextEditor({ value = "", onChange, className }: RichTextEditorProps) {
  const t = useT();
  const editor = useEditor({
    extensions: [StarterKit, TextStyle, Color, FontSize],
    content: value,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    immediatelyRender: false,
  });

  if (!editor) return null;

  const btn = (active: boolean) =>
    cn(
      "flex h-8 w-8 items-center justify-center rounded border text-sm",
      active ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-fg)]" : "border-[var(--color-border)]",
    );

  return (
    <div className={cn("rounded-[var(--radius)] border border-[var(--color-border)]", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] p-1.5">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))} aria-label={t("editor.bold")}>
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive("strike"))} aria-label={t("editor.strike")}>
          <Strikethrough className="h-4 w-4" />
        </button>

        <select
          onChange={(e) => editor.chain().focus().setMark("textStyle", { fontSize: e.target.value }).run()}
          defaultValue="1em"
          className="h-8 rounded border border-[var(--color-border)] px-1 text-sm"
          aria-label={t("editor.fontSize")}
        >
          {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <span className="mx-1 flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => editor.chain().focus().setColor(c).run()}
              aria-label={`文字色 ${c}`}
              className="h-5 w-5 rounded-full border border-[var(--color-border)]"
              style={{ backgroundColor: c }}
            />
          ))}
        </span>
      </div>
      <EditorContent editor={editor} className="prose max-w-none p-3 text-sm focus:outline-none [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:outline-none" />
    </div>
  );
}
