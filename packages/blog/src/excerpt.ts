/**
 * 抜粋(要約)生成。純ロジック。
 * Markdown/HTML を除いたプレーンテキストを作り、指定文字数で区切って抜粋を作る。
 * @packageDocumentation
 */

/** Markdown 記法をおおまかに除去してプレーンテキストにする(抜粋・検索用)。 */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")            // コードブロック
    .replace(/`[^`]*`/g, " ")                    // インラインコード
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")       // 画像
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")     // リンク(テキストのみ残す)
    .replace(/^#{1,6}\s+/gm, "")                 // 見出し記号
    .replace(/^>\s?/gm, "")                       // 引用
    .replace(/^[-*+]\s+/gm, "")                   // 箇条書き
    .replace(/^\d+\.\s+/gm, "")                   // 番号リスト
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1") // 強調
    .replace(/^[-*_]{3,}$/gm, " ")               // 水平線
    .replace(/<[^>]+>/g, " ")                     // HTML タグ
    .replace(/\s+/g, " ")
    .trim();
}

/** 抜粋生成のオプション。 */
export interface ExcerptOptions {
  /** 最大文字数(既定 120)。 */
  maxLength?: number;
  /** 末尾の省略記号(既定 "…")。 */
  ellipsis?: string;
}

/**
 * 本文(Markdown 可)から抜粋を作る。記法を除去し、指定文字数で切り、語境界で丸める。
 * 元が短ければそのまま返す。
 */
export function excerpt(content: string, options: ExcerptOptions = {}): string {
  const maxLength = options.maxLength ?? 120;
  const ellipsis = options.ellipsis ?? "…";
  const text = stripMarkdown(content);
  if (text.length <= maxLength) return text;
  let cut = text.slice(0, maxLength);
  // 直近の空白で丸める(日本語は空白が無いのでそのまま切る)
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.6) cut = cut.slice(0, lastSpace);
  return cut.trimEnd() + ellipsis;
}
