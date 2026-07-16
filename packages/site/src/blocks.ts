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

/**
 * ブロックが今表示されるかを判定する(表示フラグ + 期間)。
 *
 * **期間の指定があれば、それも見る**。「キャンペーンバナーを 3/1〜3/31 だけ出す」
 * といった予約を、人手で消さずに済ませるため。
 *
 * @param block ブロック
 * @param now 判定する時点(テスト注入用)
 * @returns 表示するなら true
 */
export function isBlockVisible(block: PageBlock, now: Date = new Date()): boolean {
  if (block.visible === false) return false;
  const t = now.getTime();
  if (block.visibleFrom && new Date(block.visibleFrom).getTime() > t) return false;
  if (block.visibleUntil && new Date(block.visibleUntil).getTime() <= t) return false;
  return true;
}

/**
 * 表示対象のブロックだけを順序どおりに返す(描画用)。
 *
 * **画面に出す前に必ず通す**。期間外のブロックが表示される事故を防ぐ。
 *
 * @param blocks ブロックの配列
 * @param now 判定する時点(テスト注入用)
 * @returns 表示対象のブロック(order 順)
 */
export function visibleBlocks(page: Page, now?: Date): PageBlock[] {
  return page.blocks.filter((b) => isBlockVisible(b, now));
}

/**
 * 指定した種類のブロックを返す。
 *
 * @param blocks ブロックの配列
 * @param type 種類
 * @returns その種類のブロック
 */
export function blocksByType(page: Page, type: BlockType): PageBlock[] {
  return page.blocks.filter((b) => b.type === type);
}

/**
 * ブロックを ID で探す。
 *
 * @param blocks ブロックの配列
 * @param id ID
 * @returns 見つかったブロック。**無ければ undefined**
 */
export function findBlock(page: Page, id: string): PageBlock | undefined {
  return page.blocks.find((b) => b.id === id);
}

/**
 * ブロックを並べ替える(from の位置から to の位置へ移動)。
 *
 * 管理画面のドラッグ&ドロップに使う。
 *
 * @param blocks ブロックの配列
 * @param from 移動元の位置
 * @param to 移動先の位置
 * @returns 並べ替えた**新しい配列**(元は変更しない)。**範囲外の位置なら元のまま**
 */
export function reorderBlocks(blocks: PageBlock[], fromIndex: number, toIndex: number): PageBlock[] {
  if (fromIndex < 0 || fromIndex >= blocks.length || toIndex < 0 || toIndex >= blocks.length) return blocks;
  const next = [...blocks];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);
  return next;
}

/**
 * ブロックを 1 つ上へ移動する。
 *
 * @param blocks ブロックの配列
 * @param id 移動するブロックの ID
 * @returns 並べ替えた新しい配列。**先頭なら変わらない**
 */
export function moveBlockUp(blocks: PageBlock[], id: string): PageBlock[] {
  const i = blocks.findIndex((b) => b.id === id);
  return i > 0 ? reorderBlocks(blocks, i, i - 1) : blocks;
}

/**
 * ブロックを 1 つ下へ移動する。
 *
 * @param blocks ブロックの配列
 * @param id 移動するブロックの ID
 * @returns 並べ替えた新しい配列。**末尾なら変わらない**
 */
export function moveBlockDown(blocks: PageBlock[], id: string): PageBlock[] {
  const i = blocks.findIndex((b) => b.id === id);
  return i >= 0 && i < blocks.length - 1 ? reorderBlocks(blocks, i, i + 1) : blocks;
}
