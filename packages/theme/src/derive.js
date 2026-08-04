/**
 * 少数のブランド色から完全なスキン(light/dark 両モード)を自動生成する。
 * カスタムテーマ作成 UI の中核。ユーザーは主色・背景の系統など数点を選ぶだけでよい。
 * @packageDocumentation
 */
import { lighten, mix, readableTextColor } from "@platform/color";
const DEFAULT_SHAPE = { fontFamily: "system-ui, sans-serif", radius: 8, spacing: 8, elevation: 1 };
/** ベース系統ごとの背景色の下地。 */
const BASE_BG = {
    light: { light: "#f7f8fa", dark: "#0f1420" },
    warm: { light: "#faf7f2", dark: "#1c1814" },
    cool: { light: "#f2f6fa", dark: "#0d1620" },
};
/** 状態色(success/warning/danger)は主色と独立に固定の視認性の良い色を使う。 */
const STATUS = {
    light: { success: "#16a34a", warning: "#d97706", danger: "#dc2626" },
    dark: { success: "#22c55e", warning: "#f59e0b", danger: "#ef4444" },
};
/**
 * ブランド色から light/dark 両モードのトークンを組み立てる。
 * - primaryFg は主色に対して読みやすい黒/白を自動選択
 * - 背景・サーフェス・枠線・補助テキストは base 系統から派生
 *
 * **1 色決めれば全部できる**のが要点。11 個のトークンを手で選ぶと、
 * 必ずどこかでコントラストを外す(そして気づかない)。
 *
 * @param seed ブランド色と、任意の調整値
 * @returns light / dark 両モードのテーマ
 */
export function deriveTheme(seed) {
    const base = seed.base ?? "light";
    const bg = BASE_BG[base] ?? BASE_BG.light;
    const accent = seed.accent ?? mix(seed.primary, "#7c3aed", 0.5);
    return {
        id: seed.id,
        name: seed.name,
        ...(seed.description ? { description: seed.description } : {}),
        shape: { ...DEFAULT_SHAPE, ...seed.shape },
        modes: {
            light: {
                bg: bg.light,
                fg: "#1a1a2e",
                muted: "#6b7280",
                surface: "#ffffff",
                border: mix(bg.light, "#000000", 0.1),
                primary: seed.primary,
                primaryFg: readableTextColor(seed.primary),
                accent,
                success: STATUS.light.success,
                warning: STATUS.light.warning,
                danger: STATUS.light.danger,
            },
            dark: {
                bg: bg.dark,
                fg: "#e6e8ee",
                muted: "#94a3b8",
                surface: lighten(bg.dark, 0.06),
                border: lighten(bg.dark, 0.14),
                primary: lighten(seed.primary, 0.08),
                primaryFg: readableTextColor(lighten(seed.primary, 0.08)),
                accent: lighten(accent, 0.08),
                success: STATUS.dark.success,
                warning: STATUS.dark.warning,
                danger: STATUS.dark.danger,
            },
        },
    };
}
//# sourceMappingURL=derive.js.map