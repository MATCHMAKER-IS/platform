/**
 * ナビゲーションメニュー(純ロジック)。
 * 階層メニューの構造、現在パスに対するアクティブ判定、パンくずの生成を行う。
 * @packageDocumentation
 */

/** メニュー項目(子を持てる)。 */
export interface MenuItem {
  label: string;
  href: string;
  children?: MenuItem[];
  /** 外部リンクか。 */
  external?: boolean;
}

/**
 * 現在のパスがこの項目に一致するかを判定する(メニューのハイライト用)。
 *
 * **既定は前方一致**。`/products/123` を開いているとき、親の「製品」も
 * ハイライトしたいため。トップページのように完全一致で判定したい項目は `exact` を指定する
 * (前方一致だと `/` は全ページに一致してしまう)。
 *
 * @param item メニュー項目
 * @param currentPath 現在のパス
 * @returns 一致すれば true
 */
export function isActive(item: MenuItem, currentPath: string, options: { exact?: boolean } = {}): boolean {
  const href = item.href.replace(/\/$/, "") || "/";
  const path = currentPath.replace(/\/$/, "") || "/";
  if (options.exact) return href === path;
  if (href === "/") return path === "/";
  return path === href || path.startsWith(href + "/");
}

/**
 * ルートから現在ページまでのアクティブな経路を返す(ハイライト・パンくず用)。
 * 深さ優先で最初に一致した経路。
 *
 * @param menu メニュー(入れ子)
 * @param currentPath 現在のパス
 * @returns 現在地までの項目(親から順)。**一致しなければ空配列**
 */
export function activeTrail(menu: MenuItem[], currentPath: string): MenuItem[] {
  function walk(items: MenuItem[]): MenuItem[] | null {
    for (const item of items) {
      if (item.children) {
        const childTrail = walk(item.children);
        if (childTrail) return [item, ...childTrail];
      }
      if (isActive(item, currentPath, { exact: true })) return [item];
    }
    // 完全一致が無ければ前方一致(親カテゴリ)
    for (const item of items) {
      if (isActive(item, currentPath)) return [item];
    }
    return null;
  }
  return walk(menu) ?? [];
}

/**
 * メニューと現在パスからパンくずを作る。
 *
 * **メニューの構造をそのまま使う**ので、パンくず用に別のデータを持たなくてよい
 * (2 か所で管理すると必ずズレる)。
 *
 * @param menu メニュー(入れ子)
 * @param currentPath 現在のパス
 * @returns 親から順のパンくず。**一致しなければ空配列**
 */
export function breadcrumbFromMenu(menu: MenuItem[], currentPath: string): { label: string; href: string }[] {
  return activeTrail(menu, currentPath).map((item) => ({ label: item.label, href: item.href }));
}

/**
 * メニューを平坦化する(全リンクの一覧・サイトマップ用)。
 *
 * @param menu メニュー(入れ子)
 * @returns すべての項目を 1 次元にした配列(**深さ優先・元の順序**)
 */
export function flattenMenu(menu: MenuItem[]): MenuItem[] {
  const out: MenuItem[] = [];
  for (const item of menu) {
    out.push(item);
    if (item.children) out.push(...flattenMenu(item.children));
  }
  return out;
}

/** パス自動パンくずのオプション。 */
export interface BreadcrumbFromPathOptions {
  /** セグメントまたは累積パスに対するラベル(例 { products: "製品", "/products/a": "製品A" })。 */
  labels?: Record<string, string>;
  /** 先頭のホーム項目(false で付けない。既定 { label: "ホーム", href: "/" })。 */
  home?: { label: string; href: string } | false;
  /** 最後の項目(現在ページ)を含めるか(既定 true)。 */
  includeCurrent?: boolean;
}

/** セグメントを見出し化する(ハイフン/アンダースコアを空白に、先頭大文字)。 */
function humanizeSegment(segment: string): string {
  return decodeURIComponent(segment)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * URL パスからパンくずを自動生成する(メニューが無い場合の簡易生成)。
 * 各セグメントを累積パスのリンクにし、ラベルは labels 優先、無ければ見出し化する。
 * 例: "/products/a" → [ホーム, 製品, 製品A]
 * @param menu メニュー(入れ子)
 * @param currentPath 現在のパス
 */
export function breadcrumbFromPath(path: string, options: BreadcrumbFromPathOptions = {}): { label: string; href: string }[] {
  const segments = (path.split("?")[0] ?? "").split("/").filter(Boolean);
  const items: { label: string; href: string }[] = [];
  if (options.home !== false) items.push(options.home ?? { label: "ホーム", href: "/" });
  const includeCurrent = options.includeCurrent ?? true;
  let acc = "";
  segments.forEach((seg, i) => {
    acc += "/" + seg;
    const isLast = i === segments.length - 1;
    if (isLast && !includeCurrent) return;
    const label = options.labels?.[acc] ?? options.labels?.[seg] ?? humanizeSegment(seg);
    items.push({ label, href: acc });
  });
  return items;
}
