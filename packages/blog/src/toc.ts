/**
 * 目次(TOC)生成。純ロジック。
 * Markdown の見出しを抽出し、アンカー用スラッグ付きの階層リストにする。
 * @packageDocumentation
 */
import { slugify } from "./slug.js";

/** 目次の 1 項目。 */
export interface TocEntry {
  /** 見出しレベル(1..6)。 */
  level: number;
  /** 見出しテキスト。 */
  text: string;
  /** アンカー(id 属性・重複回避済み)。 */
  slug: string;
}

/**
 * Markdown から見出しを抽出して目次を作る。
 * コードブロック内の # は無視。アンカーは重複しないよう調整。
 */
export function extractHeadings(markdown: string, options?: { allowUnicode?: boolean; maxLevel?: number }): TocEntry[] {
  const maxLevel = options?.maxLevel ?? 6;
  // コードブロックを除去してから走査
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, "");
  const lines = withoutCode.split("\n");
  const entries: TocEntry[] = [];
  const used = new Set<string>();
  for (const line of lines) {
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const level = m[1]!.length;
    if (level > maxLevel) continue;
    const text = m[2]!.trim();
    const base = slugify(text, { allowUnicode: options?.allowUnicode }) || "section";
    let slug = base;
    let n = 2;
    while (used.has(slug)) slug = `${base}-${n++}`;
    used.add(slug);
    entries.push({ level, text, slug });
  }
  return entries;
}
