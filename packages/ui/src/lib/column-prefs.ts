/**
 * 列の表示設定(表示/非表示・並び順)。ユーザーごとに保存する想定の純ロジック。
 * @packageDocumentation
 */

/** 列設定。 */
export interface ColumnPrefs {
  /** 表示順(key の配列)。空なら定義順。 */
  order: string[];
  /** 非表示にする列 key。 */
  hidden: string[];
}

/** 空の設定。 */
export const emptyColumnPrefs: ColumnPrefs = { order: [], hidden: [] };

/**
 * 列定義に設定(並び・非表示)を適用する。
 *
 *
 * @param columns 列定義
 * @param prefs 利用者の設定(表示・順序・幅)
 * @returns 適用後の列定義(**設定に無い列は既定のまま**。列が増えても壊れない)
 */
export function applyColumnPrefs<C extends { key: string }>(columns: C[], prefs?: ColumnPrefs): C[] {
  if (!prefs) return columns;
  const map = new Map(columns.map((c) => [c.key, c]));
  const ordered = prefs.order.map((k) => map.get(k)).filter((c): c is C => c != null);
  const inOrder = new Set(prefs.order);
  const rest = columns.filter((c) => !inOrder.has(c.key)); // order 未指定の列は末尾へ
  return [...ordered, ...rest].filter((c) => !prefs.hidden.includes(c.key));
}

/**
 * 表示/非表示を切り替える。
 *
 *
 * @param prefs 現在の設定
 * @param id 対象の列
 * @returns 更新した新しい設定
 */
export function toggleColumnHidden(prefs: ColumnPrefs, key: string): ColumnPrefs {
  const hidden = prefs.hidden.includes(key) ? prefs.hidden.filter((k) => k !== key) : [...prefs.hidden, key];
  return { ...prefs, hidden };
}

/**
 * order 内で key を上(-1)/下(+1)に移動する。order 未確定なら allKeys で初期化。
 *
 *
 * @param prefs 現在の設定
 * @param fromId 移動する列
 * @param toId 移動先
 * @returns 更新した新しい設定
 */
export function moveColumn(prefs: ColumnPrefs, key: string, dir: -1 | 1, allKeys: string[]): ColumnPrefs {
  const order = prefs.order.length ? [...prefs.order] : [...allKeys];
  const i = order.indexOf(key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return prefs;
  [order[i], order[j]] = [order[j]!, order[i]!];
  return { ...prefs, order };
}

/** 列設定の保存先(ユーザー×テーブル)。 */
export interface ColumnPrefsStore {
  load(table: string): Promise<ColumnPrefs | null>;
  save(table: string, prefs: ColumnPrefs): Promise<void>;
}

/** {@link createColumnPrefsStore} のオプション。 */
export interface ColumnPrefsStoreOptions {
  /** 例: "/api/column-prefs"。 */
  endpoint: string;
  /** 保存主体のユーザー ID。 */
  userId: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

/**
 * サーバに列設定をユーザー別で保存する fetch ストアを作る。
 *
 *
 * @param options.storage 保存先(既定 localStorage)
 * @returns ストア。**端末ごとの設定**(サーバに持つなら createFetchPresetStore)
 */
export function createColumnPrefsStore(options: ColumnPrefsStoreOptions): ColumnPrefsStore {
  const doFetch = options.fetch ?? (typeof fetch !== "undefined" ? fetch : undefined);
  const url = (table: string) => `${options.endpoint}?user=${encodeURIComponent(options.userId)}&table=${encodeURIComponent(table)}`;
  return {
    async load(table) {
      if (!doFetch) return null;
      try {
        const res = await doFetch(url(table), { headers: options.headers });
        if (!res.ok) return null;
        return (await res.json()) as ColumnPrefs;
      } catch { return null; }
    },
    async save(table, prefs) {
      if (!doFetch) return;
      await doFetch(url(table), {
        method: "PUT",
        headers: { "content-type": "application/json", ...options.headers },
        body: JSON.stringify({ userId: options.userId, table, prefs }),
      });
    },
  };
}
