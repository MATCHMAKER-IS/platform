/**
 * ナビゲーション項目のモデルとアクティブ判定(純ロジック・React 非依存)。
 * ヘッダー・サイドメニュー・モバイルナビで共通に使う。
 * @packageDocumentation
 */

/** ナビゲーション項目。 */
export interface NavItem {
  label: string;
  href: string;
  /** アイコン(コンポーネント側で描画)。 */
  icon?: unknown;
  /** バッジ(未読数など)。 */
  badge?: string | number;
  /** 外部リンク。 */
  external?: boolean;
  /** 子項目(ドロップダウン/入れ子メニュー)。 */
  children?: NavItem[];
  /** 無効化。 */
  disabled?: boolean;
  /** 表示に必要な権限(RBAC)。未指定なら常に表示。判定はアプリ側の述語で行う。 */
  permission?: string;
}

/**
 * 現在パスが href に一致するかを判定する。
 *
 * **既定は前方一致**(`/products/123` で親の「製品」もハイライトする)。
 * トップページのように完全一致で判定したい項目は `exact` を指定する
 * (**前方一致だと `/` は全ページに一致してしまう**)。
 *
 * @param href リンク先
 * @param currentPath 現在のパス
 * @param exact 完全一致で判定するか
 * @returns 一致すれば true
 */
export function isNavActive(href: string, currentPath: string, exact = false): boolean {
  const h = href.replace(/\/+$/, "") || "/";
  const p = (currentPath.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  if (exact || h === "/") return h === p;
  return p === h || p.startsWith(h + "/");
}

/**
 * アクティブな項目を返す。
 *
 * **最も具体的な一致を優先**(`/settings` と `/settings/users` が両方一致するなら、
 * 後者を選ぶ)。そうしないと、常に親だけがハイライトされる。
 *
 * @param items ナビ項目
 * @param currentPath 現在のパス
 * @returns アクティブな項目。**無ければ undefined**
 */
export function findActiveNav(items: NavItem[], currentPath: string): NavItem | undefined {
  const matches = flattenNav(items).filter((i) => isNavActive(i.href, currentPath));
  if (matches.length === 0) return undefined;
  return matches.reduce((best, i) => (i.href.length > best.href.length ? i : best));
}

/**
 * 入れ子のナビ項目を平坦化する。
 *
 * @param items ナビ項目(入れ子)
 * @returns すべての項目(**深さ優先・元の順序**)
 */
export function flattenNav(items: NavItem[]): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    out.push(item);
    if (item.children) out.push(...flattenNav(item.children));
  }
  return out;
}

/**
 * 子のいずれかがアクティブかを判定する。
 *
 * **親メニューを開いた状態にする**のに使う(現在地の項目が畳まれていると、
 * 利用者は自分がどこにいるか分からない)。
 *
 * @param item 親の項目
 * @param currentPath 現在のパス
 * @returns 子のいずれかがアクティブなら true
 */
export function hasActiveChild(item: NavItem, currentPath: string): boolean {
  return !!item.children && flattenNav(item.children).some((c) => isNavActive(c.href, currentPath));
}

/**
 * 権限述語でナビ項目を絞り込む(RBAC による出し分け)。
 * ui は auth に依存せず、`isAllowed(permission)` を受け取るだけ(例: `(p) => can(policy, roles, p)`)。
 * 子を持つ項目は、表示可能な子が 1 つも残らなければ(空グループ)非表示にする。
 *
 * @param items ナビ項目
 * @param has 権限を判定する関数
 * @returns 権限のある項目だけ(**見えないページへのリンクを出さない**。押しても 403 では不親切)
 */
export function filterNavByPermission(items: NavItem[], isAllowed: (permission: string) => boolean): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    if (item.permission != null && !isAllowed(item.permission)) continue;
    if (item.children && item.children.length > 0) {
      const children = filterNavByPermission(item.children, isAllowed);
      if (children.length === 0) continue; // 空グループは隠す
      out.push({ ...item, children });
    } else {
      out.push(item);
    }
  }
  return out;
}
