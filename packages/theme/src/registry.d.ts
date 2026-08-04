import type { Theme } from "./tokens";
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
/**
 * テーマレジストリを作る。
 *
 * **アプリで扱えるテーマの一覧**を保持し、ID からテーマを引けるようにする。
 * 利用者が選んだ ID(localStorage など)から、実際のテーマを解決するのに使う。
 *
 * @param options.themes 登録するテーマ(省略時は組み込みのスキン)
 * @param options.defaultId 既定のテーマ ID
 * @returns レジストリ。`get` で引く
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 同じ ID のテーマが重複している場合
 */
export declare function createThemeRegistry(options?: CreateThemeRegistryOptions): ThemeRegistry;
//# sourceMappingURL=registry.d.ts.map