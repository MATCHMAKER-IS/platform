/**
 * 送料計算(地域別・重量別・純ロジック)。
 * 地域(都道府県/エリア)ごとの送料と、地域別の送料無料閾値、重量段階での加算に対応。
 * @packageDocumentation
 */

/** 配送エリア。 */
export interface ShippingZone {
  /** エリア名(例 "本州", "北海道・沖縄")。 */
  name: string;
  /** このエリアに含まれる地域(都道府県名など)。 */
  regions: string[];
  /** 基本送料。 */
  fee: number;
  /** このエリアの送料無料閾値(未指定は無料なし)。 */
  freeThreshold?: number;
}

/**
 * 都道府県からエリアを返す。
 *
 * **送料はエリアで決まる**(北海道・沖縄は高い)。
 *
 * @param prefecture 都道府県
 * @returns エリア。**未知の都道府県なら null**
 */
export function resolveZone(zones: ShippingZone[], region: string): ShippingZone | undefined {
  return zones.find((z) => z.regions.includes(region));
}

/**
 * 地域と小計から送料を算出する。エリアの無料閾値を満たせば 0。
 * エリア不明時は fallbackFee(既定 0)。
 *
 * @param prefecture 都道府県
 * @param table 送料表
 * @returns 送料。**未知の都道府県なら既定の送料**(注文を止めない)
 */
export function shippingFeeForRegion(zones: ShippingZone[], region: string, subtotal: number, fallbackFee = 0): number {
  const zone = resolveZone(zones, region);
  if (!zone) return fallbackFee;
  if (zone.freeThreshold !== undefined && subtotal >= zone.freeThreshold) return 0;
  return zone.fee;
}

/** 重量段階(この重量まで → この送料)。 */
export interface WeightTier {
  /** 上限重量(g)。 */
  maxWeight: number;
  fee: number;
}

/**
 * 重量から送料を求める(段階制。昇順の tier を上から探す)。
 * どの段階も超える場合は最後の段階の送料。
 *
 * @param weight 重量
 * @param table 重量別の送料表
 * @returns 送料(**該当する段の料金**)
 */
export function weightBasedFee(weightGrams: number, tiers: WeightTier[]): number {
  const sorted = [...tiers].sort((a, b) => a.maxWeight - b.maxWeight);
  for (const tier of sorted) {
    if (weightGrams <= tier.maxWeight) return tier.fee;
  }
  return sorted[sorted.length - 1]?.fee ?? 0;
}

/**
 * 合計重量を計算する。
 *
 * **重量で送料が変わる**運送会社が多い。
 *
 * @param items 明細(重量つき)
 * @returns 合計重量
 */
export function totalWeight(items: { weight: number; quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.weight * i.quantity, 0);
}
