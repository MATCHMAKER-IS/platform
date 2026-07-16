/**
 * 列設定のプリセット(名前付き・共有可能)。個人用と共有用を扱う。
 * @packageDocumentation
 */
import type { ColumnPrefs } from "./column-prefs";

/** 列プリセット。 */
export interface ColumnPreset {
  id: string;
  name: string;
  prefs: ColumnPrefs;
  /** 全員に共有するか(false=個人)。 */
  shared?: boolean;
  /** テーブルの既定として初期適用する。 */
  isDefault?: boolean;
  ownerId?: string;
}

/**
 * プリセットを更新または追加する。
 *
 * @param presets 現在のプリセット
 * @param preset 保存するプリセット
 * @returns 更新した**新しい配列**(id が一致すれば更新、無ければ追加)
 */
export function upsertPreset(list: ColumnPreset[], preset: ColumnPreset): ColumnPreset[] {
  const i = list.findIndex((p) => p.id === preset.id);
  if (i >= 0) { const c = [...list]; c[i] = preset; return c; }
  return [...list, preset];
}

/**
 * プリセットを削除する。
 *
 * @param presets 現在のプリセット
 * @param id 削除する id
 * @returns 削除した新しい配列
 */
export function removePreset(list: ColumnPreset[], id: string): ColumnPreset[] {
  return list.filter((p) => p.id !== id);
}

/**
 * プリセットを id で探す。
 *
 * @param presets プリセットの配列
 * @param id 探す id
 * @returns プリセット。**無ければ undefined**
 */
export function findPreset(list: ColumnPreset[], id: string): ColumnPreset | undefined {
  return list.find((p) => p.id === id);
}

/**
 * 共有と個人に分ける(表示用)。
 *
 * **共有プリセットは全員に見える**ので、誤って個人の設定を共有しないよう
 * 画面で明確に分ける。
 *
 * @param presets プリセットの配列
 * @returns 共有と個人それぞれの配列
 */
export function splitPresets(list: ColumnPreset[]): { shared: ColumnPreset[]; personal: ColumnPreset[] } {
  return { shared: list.filter((p) => p.shared), personal: list.filter((p) => !p.shared) };
}

/** プリセット保存先。 */
export interface ColumnPresetStore {
  list(table: string): Promise<ColumnPreset[]>;
  save(table: string, preset: ColumnPreset): Promise<void>;
  remove(table: string, id: string): Promise<void>;
}

/** {@link createColumnPresetStore} のオプション。 */
export interface ColumnPresetStoreOptions {
  endpoint: string;
  userId: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

/**
 * サーバに保存するストアを作る。
 *
 * **端末をまたいで設定を持ち回れる**(localStorage だと別の PC では使えない)。
 *
 * @param options.endpoint API の URL
 * @param options.fetchImpl fetch の実装(テスト注入用)
 * @returns ストア(個人 + 共有のプリセットを返す)
 */
export function createColumnPresetStore(options: ColumnPresetStoreOptions): ColumnPresetStore {
  const doFetch = options.fetch ?? (typeof fetch !== "undefined" ? fetch : undefined);
  const base = (table: string) => `${options.endpoint}?user=${encodeURIComponent(options.userId)}&table=${encodeURIComponent(table)}`;
  return {
    async list(table) {
      if (!doFetch) return [];
      try {
        const res = await doFetch(base(table), { headers: options.headers });
        if (!res.ok) return [];
        return (await res.json()) as ColumnPreset[];
      } catch { return []; }
    },
    async save(table, preset) {
      if (!doFetch) return;
      await doFetch(base(table), { method: "PUT", headers: { "content-type": "application/json", ...options.headers }, body: JSON.stringify({ table, preset, ownerId: options.userId }) });
    },
    async remove(table, id) {
      if (!doFetch) return;
      await doFetch(`${base(table)}&id=${encodeURIComponent(id)}`, { method: "DELETE", headers: options.headers });
    },
  };
}

/**
 * テーブルの既定プリセットを探す。
 *
 * **初回表示で使う**(何も選ばれていないときの列構成)。
 *
 * @param presets プリセットの配列
 * @param tableId テーブル
 * @returns 既定のプリセット。**無ければ undefined**
 */
export function defaultPreset(list: ColumnPreset[]): ColumnPreset | undefined {
  return list.find((p) => (p as ColumnPreset & { isDefault?: boolean }).isDefault);
}

/**
 * 初期表示の列設定を決める。優先度: ユーザー保存 > 既定プリセット > 空。
 * @param saved ユーザーが保存した設定(無ければ null)
 * @param presets テーブルのプリセット一覧
 * @returns 初期の列設定(**既定プリセット → 保存済み設定 → 素の列定義**の順で解決)
 */
export function resolveInitialPrefs(
  saved: import("./column-prefs").ColumnPrefs | null,
  presets: ColumnPreset[],
): import("./column-prefs").ColumnPrefs {
  if (saved && (saved.order.length > 0 || saved.hidden.length > 0)) return saved;
  const def = defaultPreset(presets);
  return def ? def.prefs : { order: [], hidden: [] };
}
