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

/** 低速回線か(データ節約モードに入るべきか)。 */
export function shouldSaveData(quality: ConnectionQuality, saveDataFlag?: boolean): boolean {
  return saveDataFlag === true || quality === "slow" || quality === "offline";
}
