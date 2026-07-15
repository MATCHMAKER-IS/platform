/**
 * tween(補間アニメーション)と CSS keyframes 生成の純粋ヘルパー。
 * 実際の描画は呼び出し側(RAF/CSS)に委ね、ここでは「値の計算」と「文字列生成」に徹する。
 * @packageDocumentation
 */
import { easing } from "./motion.js";
import { easingExtra, lerp, type EasingName } from "./motion-extra.js";

/** motion.ts と motion-extra.ts の全イージングを名前で引ける統合テーブル。 */
export const allEasings = { ...easing, ...easingExtra };
export type AnyEasingName = keyof typeof allEasings;

/** 進捗 t(0–1)にイージングを適用した値を返す。未知の名前は linear。 */
export function applyEasing(name: AnyEasingName | string, t: number): number {
  const fn = (allEasings as Record<string, (t: number) => number>)[name];
  return fn ? fn(t) : t;
}

/**
 * 数値 tween の現在値を返す(時間ベース)。
 * @param from 開始値
 * @param to 終了値
 * @param elapsed 経過時間(ms)
 * @param duration 総時間(ms)
 * @param ease イージング名
 */
export function tweenValue(from: number, to: number, elapsed: number, duration: number, ease: AnyEasingName = "linear"): number {
  if (duration <= 0) return to;
  const t = Math.min(Math.max(elapsed / duration, 0), 1);
  return lerp(from, to, applyEasing(ease, t));
}

/** #rrggbb を [r,g,b] に。失敗時は null。 */
export function parseHexColor(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1] ?? "", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** [r,g,b] を #rrggbb に。 */
export function toHexColor(rgb: [number, number, number]): string {
  return "#" + rgb.map((v) => Math.round(Math.min(Math.max(v, 0), 255)).toString(16).padStart(2, "0")).join("");
}

/** 2 色を t(0–1)で補間して #rrggbb を返す。RGB 線形補間。 */
export function tweenColor(fromHex: string, toHex: string, t: number, ease: AnyEasingName = "linear"): string {
  const a = parseHexColor(fromHex);
  const b = parseHexColor(toHex);
  if (!a || !b) return fromHex;
  const e = applyEasing(ease, Math.min(Math.max(t, 0), 1));
  return toHexColor([lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e)]);
}

/** keyframe 1 コマ。offset は 0–1(パーセント)。 */
export interface Keyframe {
  offset: number;
  props: Record<string, string>;
}

/**
 * @keyframes ルール文字列を生成する。CSS-in-JS やスタイルタグ挿入で使う。
 * @param name アニメーション名
 * @param frames キーフレーム配列(offset 昇順でなくても内部でソート)
 */
export function buildKeyframes(name: string, frames: Keyframe[]): string {
  const sorted = frames.slice().sort((a, b) => a.offset - b.offset);
  const body = sorted
    .map((f) => {
      const pct = `${Math.round(Math.min(Math.max(f.offset, 0), 1) * 100)}%`;
      const decls = Object.entries(f.props).map(([k, v]) => `${k}: ${v};`).join(" ");
      return `  ${pct} { ${decls} }`;
    })
    .join("\n");
  return `@keyframes ${name} {\n${body}\n}`;
}

/** animation ショートハンドを組み立てる。 */
export function buildAnimationShorthand(options: { name: string; duration: number; easing?: string; delay?: number; iterations?: number | "infinite"; direction?: string; fillMode?: string }): string {
  const parts = [
    `${options.duration}ms`,
    options.easing ?? "ease",
    `${options.delay ?? 0}ms`,
    options.iterations === undefined ? "1" : String(options.iterations),
    options.direction ?? "normal",
    options.fillMode ?? "both",
    options.name,
  ];
  return parts.join(" ");
}

/** FLIP アニメーション用の差分(first → last の変換)。transform 文字列を返す。 */
export interface Rect { x: number; y: number; width: number; height: number; }
export function flipTransform(first: Rect, last: Rect): { transform: string; changed: boolean } {
  const dx = first.x - last.x;
  const dy = first.y - last.y;
  const sx = last.width === 0 ? 1 : first.width / last.width;
  const sy = last.height === 0 ? 1 : first.height / last.height;
  const changed = dx !== 0 || dy !== 0 || sx !== 1 || sy !== 1;
  return { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, changed };
}

export type { EasingName };
