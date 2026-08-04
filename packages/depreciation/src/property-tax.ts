/**
 * 償却資産税（固定資産税の一種）の申告計算。
 *
 * **毎年 1 月 1 日時点の資産を、1 月 31 日までに市区町村へ申告する**。
 * 忘れると過少申告になり、遡って課税されたうえに延滞金がかかる。
 *
 * 【会計の減価償却と何が違うか】
 *
 * | | 会計（法人税） | 償却資産税 |
 * |---|---|---|
 * | 償却方法 | 定額法・定率法を選べる | **旧定率法のみ**（選べない） |
 * | 月割り | 取得月から月割り | **半年分**（取得年は一律 1/2） |
 * | 残存価額 | 1 円まで償却 | **取得価額の 5% で下げ止まる** |
 * | 少額資産 | 30 万円未満は即時償却できる | **10 万円以上はすべて対象** |
 *
 * **会計上は帳簿価額 1 円の資産でも、償却資産税では 5% が残り続けて課税される**。
 * 使い終わって捨てた資産を申告から外し忘れると、払い続けることになる。
 *
 * 【免税点】
 * 課税標準額の合計が **150 万円未満なら課税されない**（申告は必要）。
 * ここを知らずに「税額 0 だから申告不要」と判断すると、申告漏れになる。
 *
 * @packageDocumentation
 */

/** 償却資産 1 件。 */
export interface TaxableAsset {
  /** 資産の名称。 */
  name: string;
  /** 取得価額（円）。 */
  acquisitionCost: number;
  /** 取得年月（YYYY-MM）。 */
  acquiredOn: string;
  /** 耐用年数（年）。 */
  usefulLifeYears: number;
  /** 除却・売却した年月（YYYY-MM。まだ保有していれば未指定）。 */
  disposedOn?: string;
}

/** 1 件の評価結果。 */
export interface AssetValuation {
  name: string;
  /** 取得価額。 */
  acquisitionCost: number;
  /** 評価額（課税標準の元になる額）。 */
  value: number;
  /** 経過年数（申告する年の 1 月 1 日時点）。 */
  elapsedYears: number;
  /** **取得価額の 5% で下げ止まっているか**。 */
  atFloor: boolean;
}

/** 申告のまとめ。 */
export interface TaxDeclaration {
  /** 申告する年（この年の 1 月 1 日時点で判定）。 */
  year: number;
  /** 対象になった資産の評価。 */
  assets: AssetValuation[];
  /** 課税標準額（評価額の合計。**1,000 円未満切り捨て**）。 */
  taxableBase: number;
  /** 免税点（150 万円）未満か。 */
  belowThreshold: boolean;
  /** 税額（課税標準額 × 1.4%。**100 円未満切り捨て**）。 */
  tax: number;
}

/** 免税点。課税標準額がこれ未満なら課税されない（**申告は必要**）。 */
export const TAX_FREE_THRESHOLD = 1_500_000;

/** 標準税率（市区町村で異なることがある）。 */
export const STANDARD_TAX_RATE = 0.014;

/** 評価額の下限（取得価額に対する割合）。**1 円までは償却しない**。 */
export const RESIDUAL_RATE = 0.05;

/**
 * 旧定率法の減価残存率を返す（耐用年数ごと）。
 *
 * **会計の定率法（200% 定率法）とは別の率**。償却資産税は旧定率法で固定されており、
 * 選ぶことはできない。表は地方税法で定められている。
 *
 * ここでは主要な耐用年数のみを持つ。**表に無い年数は近似で計算する**ため、
 * 申告書と 1 円単位で合わせるなら市区町村の表を参照すること。
 *
 * @param usefulLifeYears 耐用年数
 * @returns 減価残存率（1 年でこの割合が残る）
 */
export function decayRate(usefulLifeYears: number): number {
  /**
   * 地方税法・別表第 15 の**減価残存率**（1 年でこの割合が残る）。
   *
   * 旧定率法の償却率を r とすると、残存率は `1 - r`。
   * 耐用 5 年なら償却率 0.369 → 残存率 0.631。
   * **会計の 200% 定率法（2 ÷ 耐用年数）とは別の率**なので、混同しない。
   */
  const TABLE: Record<number, number> = {
    2: 0.316, 3: 0.464, 4: 0.562, 5: 0.631, 6: 0.684,
    7: 0.720, 8: 0.750, 9: 0.774, 10: 0.794, 11: 0.811,
    12: 0.825, 13: 0.838, 14: 0.848, 15: 0.858, 16: 0.866,
    17: 0.873, 18: 0.880, 19: 0.886, 20: 0.891, 25: 0.912,
    30: 0.926, 35: 0.936, 40: 0.944, 45: 0.950, 50: 0.955,
  };
  const years = Math.max(2, Math.floor(usefulLifeYears));
  const exact = TABLE[years];
  if (exact !== undefined) return exact;

  // **表に無い年数は近似する。**
  // 旧定率法の償却率は「n 年で残存 10% になる率」として求められる:
  //   r = 1 - (0.1)^(1/n)  → 残存率は (0.1)^(1/n)
  // 表の値とわずかにずれるため、**申告書と 1 円まで合わせるなら表を使うこと**。
  return Number((0.1 ** (1 / years)).toFixed(3));
}

/** YYYY-MM から年を取り出す。 */
function yearOf(ym: string): number {
  return Number(ym.slice(0, 4));
}

/**
 * 1 件の資産を評価する。
 *
 * **取得した年は半年分だけ償却する**（会計のような月割りではない）。
 * 2 年目以降は 1 年分。**取得価額の 5% で下げ止まる**ので、
 * 会計上 1 円になった資産でも課税対象として残り続ける。
 *
 * @param asset 資産
 * @param declarationYear 申告する年（この年の 1 月 1 日時点で判定）
 * @returns 評価結果
 *
 * @example
 * ```ts
 * // 100 万円・耐用 5 年の機械を 2024 年に取得 → 2026 年 1 月 1 日時点
 * evaluateAsset({ name: "機械", acquisitionCost: 1_000_000, acquiredOn: "2024-06", usefulLifeYears: 5 }, 2026);
 * ```
 */
export function evaluateAsset(asset: TaxableAsset, declarationYear: number): AssetValuation {
  const acquiredYear = yearOf(asset.acquiredOn);
  const rate = decayRate(asset.usefulLifeYears);
  // 申告年の 1 月 1 日時点なので、取得年からの差が経過年数
  const elapsed = Math.max(0, declarationYear - acquiredYear);

  let value: number;
  if (elapsed === 0) {
    // 取得した年（まだ 1 月 1 日を迎えていない）は申告対象外
    value = asset.acquisitionCost;
  } else {
    // **取得年は半年分**（一律 1/2）→ 2 年目以降は 1 年分
    const firstYear = asset.acquisitionCost * (1 - (1 - rate) / 2);
    value = firstYear * rate ** (elapsed - 1);
  }

  // **取得価額の 5% で下げ止まる**（会計のように 1 円までは償却しない）
  const floor = asset.acquisitionCost * RESIDUAL_RATE;
  const atFloor = value <= floor;
  return {
    name: asset.name,
    acquisitionCost: asset.acquisitionCost,
    value: Math.floor(atFloor ? floor : value),
    elapsedYears: elapsed,
    atFloor,
  };
}

/**
 * 申告する年の 1 月 1 日時点で課税対象かを判定する。
 *
 * **10 万円未満は対象外**（会計で即時償却できる少額資産）。
 * ただし **30 万円未満の少額資産の特例を使った資産は対象**になる点に注意
 * （会計では費用にしていても、償却資産税では申告が要る）。
 *
 * @param asset 資産
 * @param declarationYear 申告する年
 * @returns 対象なら true
 */
export function isTaxable(asset: TaxableAsset, declarationYear: number): boolean {
  if (asset.acquisitionCost < 100_000) return false;
  // 前年中に取得したものから対象（申告年の 1 月 1 日に保有している）
  if (yearOf(asset.acquiredOn) >= declarationYear) return false;
  // **除却したら外す。** 外し忘れると、捨てた資産の税を払い続ける
  if (asset.disposedOn !== undefined && yearOf(asset.disposedOn) < declarationYear) return false;
  return true;
}

/**
 * 償却資産税の申告内容をまとめる。
 *
 * **課税標準額が 150 万円未満なら課税されないが、申告そのものは必要**。
 * 「税額 0 だから出さなくてよい」と判断すると申告漏れになる。
 *
 * @param assets 保有する資産
 * @param declarationYear 申告する年（この年の 1 月 1 日時点）
 * @param taxRate 税率（既定 1.4%。市区町村で異なることがある）
 * @returns 申告のまとめ
 *
 * @example
 * ```ts
 * const d = buildDeclaration(assets, 2026);
 * if (d.belowThreshold) console.log("免税点未満ですが、申告は必要です");
 * ```
 */
export function buildDeclaration(
  assets: readonly TaxableAsset[],
  declarationYear: number,
  taxRate: number = STANDARD_TAX_RATE,
): TaxDeclaration {
  const valuations = assets
    .filter((a) => isTaxable(a, declarationYear))
    .map((a) => evaluateAsset(a, declarationYear));

  const total = valuations.reduce((s, v) => s + v.value, 0);
  // **課税標準額は 1,000 円未満切り捨て**
  const taxableBase = Math.floor(total / 1000) * 1000;
  const belowThreshold = taxableBase < TAX_FREE_THRESHOLD;
  // **税額は 100 円未満切り捨て**
  const tax = belowThreshold ? 0 : Math.floor((taxableBase * taxRate) / 100) * 100;

  return { year: declarationYear, assets: valuations, taxableBase, belowThreshold, tax };
}

/**
 * 申告から外し忘れている資産を探す。
 *
 * **使い終わって捨てた資産を申告から外し忘れる**のが最も多い誤り。
 * 会計上は除却しているのに償却資産の台帳が更新されず、
 * **存在しない資産の税を払い続ける**ことになる。
 *
 * @param assets 保有する資産
 * @param declarationYear 申告する年
 * @returns 確認が要る資産と、その理由
 *
 * @example
 * ```ts
 * const issues = findStaleAssets(assets, 2026);
 * // → 「5% で下げ止まって 3 年。まだ使っていますか？」
 * ```
 */
export function findStaleAssets(
  assets: readonly TaxableAsset[],
  declarationYear: number,
): { name: string; reason: string }[] {
  const out: { name: string; reason: string }[] = [];
  for (const a of assets) {
    if (!isTaxable(a, declarationYear)) continue;
    const v = evaluateAsset(a, declarationYear);
    if (!v.atFloor) continue;

    // 5% に達してから何年経っているか（おおよそ耐用年数を過ぎた分）
    const overYears = v.elapsedYears - a.usefulLifeYears;
    if (overYears >= 2) {
      out.push({
        name: a.name,
        reason: `耐用年数(${a.usefulLifeYears}年)を ${overYears} 年過ぎ、評価額は取得価額の 5% で下げ止まっています。`
          + "**まだ使っていますか。** 除却済みなら申告から外さないと、税を払い続けます",
      });
    }
  }
  return out;
}
