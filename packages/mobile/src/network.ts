/**
 * ネットワーク状態の分類(純ロジック)。
 * Network Information API の effectiveType/downlink から通信品質を判定する。
 * モバイルの低速回線での挙動制御(画像圧縮・自動再生抑制など)に使う。
 * @packageDocumentation
 */

/** 通信品質のカテゴリ。 */
export type ConnectionQuality = "offline" | "slow" | "moderate" | "fast" | "unknown";

/** effectiveType の型(NetworkInformation.effectiveType)。 */
export type EffectiveType = "slow-2g" | "2g" | "3g" | "4g";

/**
 * ネットワーク情報から通信品質を分類する。
 * @param input online 状態と effectiveType/downlink(Mbps)
 * @returns 回線の分類(`slow` / `fast` / `unknown`)。**非対応のブラウザでは unknown**
 */
export function classifyConnection(input: { online?: boolean; effectiveType?: string; downlink?: number }): ConnectionQuality {
  if (input.online === false) return "offline";
  const et = input.effectiveType;
  if (et === "slow-2g" || et === "2g") return "slow";
  if (et === "3g") return "moderate";
  if (et === "4g") return "fast";
  // effectiveType が無ければ downlink(Mbps)で判定
  if (typeof input.downlink === "number") {
    if (input.downlink < 0.5) return "slow";
    if (input.downlink < 2) return "moderate";
    return "fast";
  }
  return "unknown";
}

/**
 * 低速回線かを判定する。
 *
 * **画像の解像度を落とす**などの判断に使う。`saveData`(データセーバー)も見る
 * (利用者が明示的に節約したいと言っているなら従う)。
 *
 * @returns 低速なら true。**非対応のブラウザでは false**(判断材料が無い)
 * @param connection 回線情報
 */
export function shouldSaveData(quality: ConnectionQuality, saveDataFlag?: boolean): boolean {
  return saveDataFlag === true || quality === "slow" || quality === "offline";
}
