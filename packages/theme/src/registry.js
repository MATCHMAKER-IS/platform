/**
 * テーマ(スキン)のレジストリ。標準テーマを登録し、アプリ側から自由に追加できる。
 * これが「後からテーマを拡充できる拡張性」の中心。
 * @packageDocumentation
 */
import { AppError, ErrorCode } from "@platform/core";
import { isValidThemeId } from "./tokens";
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
export function createThemeRegistry(options = {}) {
    const map = new Map();
    const order = [];
    let defaultId = options.defaultId;
    const register = (theme) => {
        if (!isValidThemeId(theme.id)) {
            throw new AppError(ErrorCode.VALIDATION, `不正なテーマ id: ${theme.id}(英数字・ハイフンのみ)`);
        }
        if (!map.has(theme.id))
            order.push(theme.id);
        map.set(theme.id, theme);
    };
    if (options.themes)
        for (const t of options.themes)
            register(t);
    if (defaultId === undefined && order.length > 0)
        defaultId = order[0];
    return {
        register,
        registerAll(themes) {
            for (const t of themes)
                register(t);
        },
        get(id) {
            return map.get(id);
        },
        list() {
            return order.map((id) => map.get(id)).filter((t) => t !== undefined);
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
            if (!map.has(id))
                throw new AppError(ErrorCode.NOT_FOUND, `未登録のテーマ: ${id}`);
            defaultId = id;
        },
        resolve(id) {
            if (id !== undefined) {
                const t = map.get(id);
                if (t)
                    return t;
            }
            if (defaultId !== undefined) {
                const d = map.get(defaultId);
                if (d)
                    return d;
            }
            throw new AppError(ErrorCode.NOT_FOUND, `テーマが見つかりません: ${id ?? "(既定なし)"}`);
        },
    };
}
//# sourceMappingURL=registry.js.map