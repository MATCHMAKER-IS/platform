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

/** 現在パスがこの href に一致するか。exact でなければ前方一致(親のハイライト)。 */
export function isNavActive(href: string, currentPath: string, exact = false): boolean {
  const h = href.replace(/\/+$/, "") || "/";
  const p = (currentPath.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  if (exact || h === "/") return h === p;
  return p === h || p.startsWith(h + "/");
}

/** 項目群のうちアクティブなものを返す(最も具体的=href が長い一致を優先)。 */
export function findActiveNav(items: NavItem[], currentPath: string): NavItem | undefined {
  const matches = flattenNav(items).filter((i) => isNavActive(i.href, currentPath));
  if (matches.length === 0) return undefined;
  return matches.reduce((best, i) => (i.href.length > best.href.length ? i : best));
}

/** 入れ子のナビ項目を平坦化する。 */
export function flattenNav(items: NavItem[]): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    out.push(item);
    if (item.children) out.push(...flattenNav(item.children));
  }
  return out;
}

/** 親項目が(子のいずれかが)アクティブか。親メニューを開いた状態にする判定に。 */
export function hasActiveChild(item: NavItem, currentPath: string): boolean {
  return !!item.children && flattenNav(item.children).some((c) => isNavActive(c.href, currentPath));
}

/**
 * 権限述語でナビ項目を絞り込む(RBAC による出し分け)。
 * ui は auth に依存せず、`isAllowed(permission)` を受け取るだけ(例: `(p) => can(policy, roles, p)`)。
 * 子を持つ項目は、表示可能な子が 1 つも残らなければ(空グループ)非表示にする。
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
