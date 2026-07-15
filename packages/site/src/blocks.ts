/**
 * ページ構成(セクションブロック・純ロジック)。
 * LP や公式サイトのページを「ブロックの並び」として構造化する。ヒーロー・特徴・CTA・FAQ 等の
 * ブロックを並べ替え・表示制御し、公開中のブロックだけを描画用に取り出す。
 * 各ブロックの描画(見た目)はアプリ側、ここは構造と表示ロジックのみ。
 * @packageDocumentation
 */

/** ブロックの種類。 */
export type BlockType =
  | "hero" | "features" | "cta" | "faq" | "testimonials"
  | "richText" | "gallery" | "stats" | "pricing" | "logos" | "contact" | "steps";

/** ページを構成する 1 ブロック。 */
export interface PageBlock {
  id: string;
  type: BlockType;
  /** ブロック固有のデータ(見出し・画像・項目など)。 */
  data: Record<string, unknown>;
  /** 表示するか(下書き・非表示の制御。既定 true)。 */
  visible?: boolean;
  /** 表示開始日時(ISO 8601・期間限定セクション)。 */
  visibleFrom?: string;
  /** 表示終了日時(ISO 8601)。 */
  visibleUntil?: string;
}

/** ページ。 */
export interface Page {
  slug: string;
  title: string;
  blocks: PageBlock[];
}

/** ブロックが今の時点で表示対象か(visible + 期間)。 */
export function isBlockVisible(block: PageBlock, now: Date = new Date()): boolean {
  if (block.visible === false) return false;
  const t = now.getTime();
  if (block.visibleFrom && new Date(block.visibleFrom).getTime() > t) return false;
  if (block.visibleUntil && new Date(block.visibleUntil).getTime() <= t) return false;
  return true;
}

/** 公開中のブロックだけを順序どおりに返す(描画用)。 */
export function visibleBlocks(page: Page, now?: Date): PageBlock[] {
  return page.blocks.filter((b) => isBlockVisible(b, now));
}

/** 指定タイプのブロックを返す。 */
export function blocksByType(page: Page, type: BlockType): PageBlock[] {
  return page.blocks.filter((b) => b.type === type);
}

/** ブロックを ID で探す。 */
export function findBlock(page: Page, id: string): PageBlock | undefined {
  return page.blocks.find((b) => b.id === id);
}

/** ブロックを並べ替える(from の位置から to の位置へ移動)。元配列は変更しない。 */
export function reorderBlocks(blocks: PageBlock[], fromIndex: number, toIndex: number): PageBlock[] {
  if (fromIndex < 0 || fromIndex >= blocks.length || toIndex < 0 || toIndex >= blocks.length) return blocks;
  const next = [...blocks];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);
  return next;
}

/** ブロックを 1 つ上へ。 */
export function moveBlockUp(blocks: PageBlock[], id: string): PageBlock[] {
  const i = blocks.findIndex((b) => b.id === id);
  return i > 0 ? reorderBlocks(blocks, i, i - 1) : blocks;
}

/** ブロックを 1 つ下へ。 */
export function moveBlockDown(blocks: PageBlock[], id: string): PageBlock[] {
  const i = blocks.findIndex((b) => b.id === id);
  return i >= 0 && i < blocks.length - 1 ? reorderBlocks(blocks, i, i + 1) : blocks;
}
