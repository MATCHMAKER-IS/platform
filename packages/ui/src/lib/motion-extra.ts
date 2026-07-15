/**
 * アニメーション拡充ヘルパー(既存 motion.ts を補完)。
 * イージングの追加(quart〜bounce)・補間(lerp/mapRange)・stagger・spring 物理・
 * keyframes 文字列生成・数値/色 tween・FLIP 差分など、純粋計算で構成する。
 *
 * 既存 motion.ts と重複しない範囲のみを追加する(easing base セットは motion.ts、
 * こちらは quart 以降と高次のイージング + ユーティリティ)。
 * @packageDocumentation
 */
import { clamp01 } from "./motion.js";

const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;
const c4 = (2 * Math.PI) / 3;
const c5 = (2 * Math.PI) / 4.5;

function bounceOut(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) { const t2 = t - 1.5 / d1; return n1 * t2 * t2 + 0.75; }
  if (t < 2.5 / d1) { const t2 = t - 2.25 / d1; return n1 * t2 * t2 + 0.9375; }
  const t2 = t - 2.625 / d1;
  return n1 * t2 * t2 + 0.984375;
}

/** 拡張イージング関数(0–1 → 0–1)。back/elastic/bounce は 0–1 を超える範囲を返しうる。 */
export const easingExtra = {
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  easeInOutQuart: (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  easeInQuint: (t: number) => t * t * t * t * t,
  easeOutQuint: (t: number) => 1 - Math.pow(1 - t, 5),
  easeInExpo: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t: number) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  easeInSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t: number) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeInBack: (t: number) => c3 * t * t * t - c1 * t * t,
  easeOutBack: (t: number) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  easeInOutBack: (t: number) => (t < 0.5 ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2 : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2),
  easeInElastic: (t: number) => (t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4)),
  easeOutElastic: (t: number) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1),
  easeInOutElastic: (t: number) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2 : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1),
  easeOutBounce: bounceOut,
  easeInBounce: (t: number) => 1 - bounceOut(1 - t),
  easeInOutBounce: (t: number) => (t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2),
} as const;

/** 名前でイージング関数を引く(easingExtra のキー)。 */
export type EasingName = keyof typeof easingExtra;

/** 線形補間。t=0 で a、t=1 で b。 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 逆補間。value が a→b のどこにあるか(0–1)。 */
export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) return 0;
  return (value - a) / (b - a);
}

/** 値をある範囲から別の範囲へ写像する。clamp=true で出力を outMin–outMax に丸める。 */
export function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number, clamp = false): number {
  const t = inverseLerp(inMin, inMax, value);
  const out = lerp(outMin, outMax, t);
  if (!clamp) return out;
  const lo = Math.min(outMin, outMax);
  const hi = Math.max(outMin, outMax);
  return out < lo ? lo : out > hi ? hi : out;
}

/**
 * stagger ディレイ(ms)の配列を返す。リスト表示の順次アニメーションに。
 * @param count 要素数
 * @param step  1 要素あたりの遅延(ms)
 * @param options.from "start" | "end" | "center"(中央から広がる)
 */
export function staggerDelays(count: number, step: number, options: { from?: "start" | "end" | "center"; base?: number } = {}): number[] {
  const from = options.from ?? "start";
  const base = options.base ?? 0;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    let order = i;
    if (from === "end") order = count - 1 - i;
    else if (from === "center") order = Math.abs(i - (count - 1) / 2);
    out.push(base + order * step);
  }
  return out;
}

/** バネ物理の1ステップ。位置・速度を更新して返す(RAF ループで反復)。 */
export interface SpringState { position: number; velocity: number; }
export interface SpringConfig { stiffness?: number; damping?: number; mass?: number; }

/**
 * バネ物理を1ステップ進める(半陰的オイラー法)。
 * @param state 現在の位置・速度
 * @param target 目標位置
 * @param config stiffness(剛性)/damping(減衰)/mass(質量)
 * @param dt 時間刻み(秒)。RAF なら概ね 1/60。
 */
export function stepSpring(state: SpringState, target: number, config: SpringConfig = {}, dt = 1 / 60): SpringState {
  const stiffness = config.stiffness ?? 170;
  const damping = config.damping ?? 26;
  const mass = config.mass ?? 1;
  const springForce = -stiffness * (state.position - target);
  const dampingForce = -damping * state.velocity;
  const acceleration = (springForce + dampingForce) / mass;
  const velocity = state.velocity + acceleration * dt;
  const position = state.position + velocity * dt;
  return { position, velocity };
}

/** バネが静止したとみなせるか(位置が目標近傍かつ速度が小さい)。 */
export function isSpringSettled(state: SpringState, target: number, epsilon = 0.01): boolean {
  return Math.abs(state.position - target) < epsilon && Math.abs(state.velocity) < epsilon;
}

export { clamp01 };
