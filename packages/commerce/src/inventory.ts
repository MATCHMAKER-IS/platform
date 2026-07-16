/**
 * 在庫(引当・純ロジック)。
 * 在庫数の確認と、注文に対する引当(reserve)・解放(release)・確定(commit)を扱う。
 * available=販売可能数, reserved=引当済み(決済待ち等)。保存はアプリ側。
 * @packageDocumentation
 */

/** 在庫の状態。 */
export interface StockLevel {
  /** 販売可能数。 */
  available: number;
  /** 引当済み数(カート確保・決済待ち)。 */
  reserved: number;
}

/**
 * 在庫を作る。
 *
 * @param variantId 商品バリアント
 * @param quantity 数量
 * @returns 在庫
 */
export function stock(available: number, reserved = 0): StockLevel {
  return { available: Math.max(0, available), reserved: Math.max(0, reserved) };
}

/**
 * 指定数量の在庫があるかを判定する。
 *
 * **引当済みを除いた数**で見る(誰かがカートに入れている分は買えない)。
 *
 * @param stock 在庫
 * @param quantity 欲しい数量
 * @returns 足りていれば true
 */
export function inStock(level: StockLevel, quantity = 1): boolean {
  return level.available >= quantity;
}

/**
 * 在庫切れかを判定する。
 *
 * @param stock 在庫
 * @returns 引当可能な数が 0 なら true
 */
export function isOutOfStock(level: StockLevel): boolean {
  return level.available <= 0;
}

/** 引当の結果。 */
export interface StockResult {
  ok: boolean;
  level: StockLevel;
}

/**
 * 在庫を引き当てる(available を減らし reserved を増やす)。
 * 在庫不足なら ok:false で在庫は変更しない。
 *
 * @param stock 在庫
 * @param quantity 引き当てる数量
 * @returns 更新した在庫。**足りなければ元のまま**(勝手にマイナスにしない)
 */
export function reserveStock(level: StockLevel, quantity: number): StockResult {
  if (quantity <= 0 || level.available < quantity) return { ok: false, level };
  return { ok: true, level: { available: level.available - quantity, reserved: level.reserved + quantity } };
}

/**
 * 引当を解放する(キャンセル・カートの期限切れ)。
 *
 * **引当したまま放置すると、在庫があるのに買えない**状態になる。
 * カートに期限を設けて、自動で解放すること。
 *
 * @param stock 在庫
 * @param quantity 解放する数量
 * @returns 更新した新しい在庫
 */
export function releaseStock(level: StockLevel, quantity: number): StockResult {
  if (quantity <= 0 || level.reserved < quantity) return { ok: false, level };
  return { ok: true, level: { available: level.available + quantity, reserved: level.reserved - quantity } };
}

/**
 * 引当を確定する(出荷・決済完了)。
 *
 * **`reserved` を減らすだけ**(`available` は引当の時点で減っている)。
 * ここで両方減らすと二重に減る。
 *
 * @param stock 在庫
 * @param quantity 確定する数量
 * @returns 更新した新しい在庫
 */
export function commitStock(level: StockLevel, quantity: number): StockResult {
  if (quantity <= 0 || level.reserved < quantity) return { ok: false, level };
  return { ok: true, level: { available: level.available, reserved: level.reserved - quantity } };
}

/** 注文明細(在庫判定用)。 */
export interface OrderLine {
  productId: string;
  quantity: number;
}

/** 在庫不足の明細。 */
export interface Shortage {
  productId: string;
  requested: number;
  available: number;
}

/**
 * カート/注文が在庫を満たすか判定する。
 * @param stockMap 商品 ID → 販売可能数
 * @returns 満たすか、不足明細
 */
export function canFulfill(stockMap: Record<string, number>, lines: OrderLine[]): { ok: boolean; shortages: Shortage[] } {
  const shortages: Shortage[] = [];
  for (const line of lines) {
    const available = stockMap[line.productId] ?? 0;
    if (available < line.quantity) shortages.push({ productId: line.productId, requested: line.quantity, available });
  }
  return { ok: shortages.length === 0, shortages };
}
