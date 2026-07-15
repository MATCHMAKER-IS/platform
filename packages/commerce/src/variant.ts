/**
 * 商品バリエーション(純ロジック)。
 * サイズ・色などの選択肢の組み合わせごとに SKU・価格・在庫を持つ。
 * 選択に応じたバリエーション特定、在庫を踏まえた選択可能な値の抽出、価格帯の算出。
 * @packageDocumentation
 */

/** バリエーションの選択肢軸(例: サイズ = S/M/L)。 */
export interface VariantOption {
  /** 軸の名前(例 "サイズ")。 */
  name: string;
  /** 選べる値(例 ["S","M","L"])。 */
  values: string[];
}

/** 1 つのバリエーション(選択肢の組み合わせ)。 */
export interface ProductVariant {
  sku: string;
  /** 選択肢の組み合わせ(例 { サイズ:"M", 色:"赤" })。 */
  options: Record<string, string>;
  price: number;
  /** 在庫数(未指定は在庫管理しない=常に可)。 */
  stock?: number;
}

/** 選択された組み合わせに一致するバリエーションを返す。 */
export function findVariant(variants: ProductVariant[], selected: Record<string, string>): ProductVariant | undefined {
  const keys = Object.keys(selected);
  return variants.find((v) => keys.every((k) => v.options[k] === selected[k]));
}

/** バリエーションに在庫があるか(stock 未指定は在庫ありとみなす)。 */
export function variantInStock(variant: ProductVariant, quantity = 1): boolean {
  return variant.stock === undefined || variant.stock >= quantity;
}

/**
 * ある軸について、現在の部分選択のもとで在庫のある値だけを返す。
 * 例: 色="赤" を選んだとき、在庫のあるサイズだけを有効化する(売り切れ組み合わせを無効表示)。
 */
export function availableValues(variants: ProductVariant[], optionName: string, partialSelection: Record<string, string> = {}): string[] {
  const otherKeys = Object.keys(partialSelection).filter((k) => k !== optionName);
  const values = new Set<string>();
  for (const v of variants) {
    if (!otherKeys.every((k) => v.options[k] === partialSelection[k])) continue;
    if (!variantInStock(v)) continue;
    const val = v.options[optionName];
    if (val !== undefined) values.add(val);
  }
  return [...values];
}

/** バリエーションの価格帯(最小・最大)。 */
export function priceRange(variants: ProductVariant[]): { min: number; max: number } | null {
  if (variants.length === 0) return null;
  const prices = variants.map((v) => v.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** 全バリエーションが売り切れか。 */
export function isAllSoldOut(variants: ProductVariant[]): boolean {
  return variants.length > 0 && variants.every((v) => !variantInStock(v));
}
