/**
 * バナー・広告枠の管理（純関数）。スケジュール・対象パス・重み付きローテーション。
 * @packageDocumentation
 */

/** バナー（広告枠のクリエイティブ）。 */
export interface Banner {
  id: string;
  /** 画像 URL。 */
  image: string;
  /** リンク先。 */
  href: string;
  /** 代替テキスト。 */
  alt?: string;
  /** 表示枠（"sidebar" / "header" など任意）。 */
  slot?: string;
  /** ローテーションの重み（既定 1）。 */
  weight?: number;
  /** 表示開始（ISO）。 */
  startAt?: string;
  /** 表示終了（ISO）。 */
  endAt?: string;
  /** 対象パス（前方一致・未指定は全ページ）。 */
  paths?: string[];
  /** スポンサー表記など。 */
  sponsored?: boolean;
}

function pathMatches(paths: string[] | undefined, currentPath: string): boolean {
  if (!paths || paths.length === 0) return true;
  return paths.some((p) => currentPath === p || currentPath.startsWith(p));
}

/**
 * バナーが今表示されるかを判定する(期間 + パス + 枠)。
 *
 * @param banner バナー
 * @param context.path 現在のパス
 * @param context.slot 表示枠
 * @param context.now 判定する時点(テスト注入用)
 * @returns 表示するなら true
 */
export function isBannerActive(banner: Banner, currentPath: string, options: { now?: Date; slot?: string } = {}): boolean {
  const t = (options.now ?? new Date()).getTime();
  if (banner.startAt && new Date(banner.startAt).getTime() > t) return false;
  if (banner.endAt && new Date(banner.endAt).getTime() < t) return false;
  if (options.slot !== undefined && banner.slot !== options.slot) return false;
  return pathMatches(banner.paths, currentPath);
}

/**
 * 表示対象のバナーを絞り込む。
 *
 * @param banners バナーの配列
 * @param context パス・枠・時点
 * @returns 表示対象のバナー
 */
export function activeBanners(banners: Banner[], currentPath: string, options: { now?: Date; slot?: string } = {}): Banner[] {
  return banners.filter((b) => isBannerActive(b, currentPath, options));
}

/**
 * 重み付きでバナーを 1 つ選ぶ。
 *
 * **乱数を引数で受け取る**ので純関数(テストで結果を固定できる)。
 * 重みは「A を 7 割、B を 3 割で出す」といった配分に使う。
 *
 * @param banners バナーの配列
 * @param r 0〜1 の乱数
 * @returns 選ばれたバナー。**対象が無ければ null**
 */
export function pickBanner(banners: Banner[], r: number): Banner | null {
  if (banners.length === 0) return null;
  const weights = banners.map((b) => Math.max(0, b.weight ?? 1));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return banners[0]!;
  let threshold = r * total;
  for (let i = 0; i < banners.length; i++) {
    threshold -= weights[i]!;
    if (threshold < 0) return banners[i]!;
  }
  return banners[banners.length - 1]!;
}

/**
 * 表示対象を絞ってから重み付きで 1 つ選ぶ(実際に使うのはこちら)。
 *
 * @param banners バナーの配列
 * @param context パス・枠・時点
 * @param r 0〜1 の乱数
 * @returns 選ばれたバナー。対象が無ければ null
 */
export function rotateBanner(banners: Banner[], currentPath: string, options: { now?: Date; slot?: string; random?: () => number } = {}): Banner | null {
  const active = activeBanners(banners, currentPath, options);
  return pickBanner(active, (options.random ?? Math.random)());
}
