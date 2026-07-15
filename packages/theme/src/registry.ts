/**
 * テーマ(スキン)のレジストリ。標準テーマを登録し、アプリ側から自由に追加できる。
 * これが「後からテーマを拡充できる拡張性」の中心。
 * @packageDocumentation
 */
import { AppError, ErrorCode } from "@platform/core";
import type { Theme } from "./tokens.js";
import { isValidThemeId } from "./tokens.js";

export interface ThemeRegistry {
  /** テーマを登録する(同 id は上書き)。id が不正なら VALIDATION エラー。 */
  register(theme: Theme): void;
  /** 複数まとめて登録。 */
  registerAll(themes: Theme[]): void;
  /** id でテーマを取得(無ければ undefined)。 */
  get(id: string): Theme | undefined;
  /** 登録済みの全テーマ(登録順)。 */
  list(): Theme[];
  /** id の一覧。 */
  ids(): string[];
  /** 存在確認。 */
  has(id: string): boolean;
  /** 既定テーマの id(list の先頭、または明示設定)。 */
  getDefaultId(): string | undefined;
  /** 既定テーマを設定する(未登録 id は NOT_FOUND)。 */
  setDefault(id: string): void;
  /** テーマを取得。無ければ既定、既定も無ければ NOT_FOUND を投げる。 */
  resolve(id?: string): Theme;
}

export interface CreateThemeRegistryOptions {
  /** 初期登録するテーマ。 */
  themes?: Theme[];
  /** 既定テーマ id。 */
  defaultId?: string;
}

export function createThemeRegistry(options: CreateThemeRegistryOptions = {}): ThemeRegistry {
  const map = new Map<string, Theme>();
  const order: string[] = [];
  let defaultId: string | undefined = options.defaultId;

  const register = (theme: Theme): void => {
    if (!isValidThemeId(theme.id)) {
      throw new AppError(ErrorCode.VALIDATION, `不正なテーマ id: ${theme.id}(英数字・ハイフンのみ)`);
    }
    if (!map.has(theme.id)) order.push(theme.id);
    map.set(theme.id, theme);
  };

  if (options.themes) for (const t of options.themes) register(t);
  if (defaultId === undefined && order.length > 0) defaultId = order[0];

  return {
    register,
    registerAll(themes) {
      for (const t of themes) register(t);
    },
    get(id) {
      return map.get(id);
    },
    list() {
      return order.map((id) => map.get(id)).filter((t): t is Theme => t !== undefined);
    },
    ids() {
      return [...order];
    },
    has(id) {
      return map.has(id);
    },
    getDefaultId() {
      return defaultId;
    },
    setDefault(id) {
      if (!map.has(id)) throw new AppError(ErrorCode.NOT_FOUND, `未登録のテーマ: ${id}`);
      defaultId = id;
    },
    resolve(id) {
      if (id !== undefined) {
        const t = map.get(id);
        if (t) return t;
      }
      if (defaultId !== undefined) {
        const d = map.get(defaultId);
        if (d) return d;
      }
      throw new AppError(ErrorCode.NOT_FOUND, `テーマが見つかりません: ${id ?? "(既定なし)"}`);
    },
  };
}
