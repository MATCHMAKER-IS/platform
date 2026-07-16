"use client";
/**
 * アニメーション用 React フック。motion-extra / motion-tween の純関数を RAF で駆動する。
 * useTween(値アニメ)・useSpring(バネ物理)・useInView(表示検知で reveal)。
 * @packageDocumentation
 */
import * as React from "react";
import { tweenValue, type AnyEasingName } from "../lib/motion-tween";
import { stepSpring, isSpringSettled, type SpringConfig } from "../lib/motion-extra";

/** {@link useTween} のオプション。 */
export interface UseTweenOptions {
  duration?: number;
  easing?: AnyEasingName;
  /** 依存が変わったら最初から再生(既定 true)。 */
  autoStart?: boolean;
}

/**
 * from → to へ duration(ms)かけて値を補間するフック。RAF で毎フレーム更新。
 * @returns 現在値
 * @param options.from / to 開始と終了の値
 * @param options.duration 時間
 * @param options.easing イージング
 */
export function useTween(from: number, to: number, options: UseTweenOptions = {}): number {
  const { duration = 300, easing = "easeOutCubic" } = options;
  const [value, setValue] = React.useState(from);
  const rafRef = React.useRef<number | null>(null);
  const startRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    startRef.current = null;
    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const raf = (globalThis as unknown as { requestAnimationFrame?: (cb: (t: number) => void) => number }).requestAnimationFrame;
    const caf = (globalThis as unknown as { cancelAnimationFrame?: (h: number) => void }).cancelAnimationFrame;
    if (!raf) { setValue(to); return; } // RAF 無し(SSR 等)は即最終値

    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const v = tweenValue(from, to, elapsed, duration, easing);
      setValue(v);
      if (elapsed < duration) rafRef.current = raf(tick);
      else setValue(to);
    };
    rafRef.current = raf(tick);
    return () => { if (rafRef.current !== null && caf) caf(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, duration, easing]);

  return value;
}

/**
 * バネ物理で target に追従する値を返すフック。ドラッグ追従・滑らかな数値変化に。
 * @returns 現在値
 * @param options.stiffness / damping バネの特性(**硬さと減衰**。tween と違い、**途中で目標が変わっても自然に繋がる**)
 */
export function useSpring(target: number, config: SpringConfig = {}): number {
  const [value, setValue] = React.useState(target);
  const stateRef = React.useRef({ position: target, velocity: 0 });
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const raf = (globalThis as unknown as { requestAnimationFrame?: (cb: (t: number) => void) => number }).requestAnimationFrame;
    const caf = (globalThis as unknown as { cancelAnimationFrame?: (h: number) => void }).cancelAnimationFrame;
    if (!raf) { stateRef.current = { position: target, velocity: 0 }; setValue(target); return; }

    const tick = () => {
      const next = stepSpring(stateRef.current, target, config);
      stateRef.current = next;
      setValue(next.position);
      if (!isSpringSettled(next, target)) rafRef.current = raf(tick);
      else { stateRef.current = { position: target, velocity: 0 }; setValue(target); }
    };
    rafRef.current = raf(tick);
    return () => { if (rafRef.current !== null && caf) caf(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, config.stiffness, config.damping, config.mass]);

  return value;
}

/** {@link useInView} のオプション。 */
export interface UseInViewOptions {
  /** 一度表示されたら監視を止める(既定 true・reveal 用途)。 */
  once?: boolean;
  /** IntersectionObserver の閾値(既定 0.1)。 */
  threshold?: number;
  rootMargin?: string;
}

/**
 * 要素がビューポートに入ったかを検知するフック(IntersectionObserver)。
 * reveal アニメーション(フェードイン等)のトリガーに使う。
 * @returns [ref を渡す関数, 表示中か]
 * @param options.threshold 交差の割合(**0.5 なら半分見えたら発火**)
 * @param options.once 一度だけ発火するか
 */
export function useInView<T extends Element = Element>(options: UseInViewOptions = {}): [(el: T | null) => void, boolean] {
  const { once = true, threshold = 0.1, rootMargin } = options;
  const [inView, setInView] = React.useState(false);
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const elRef = React.useRef<T | null>(null);

  const setRef = React.useCallback((el: T | null) => {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    elRef.current = el;
    const IO = (globalThis as unknown as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
    if (!el || !IO) { if (!IO) setInView(true); return; } // IO 無し(SSR)は表示扱い
    const obs = new IO((entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (entry.isIntersecting) {
        setInView(true);
        if (once) { obs.disconnect(); observerRef.current = null; }
      } else if (!once) {
        setInView(false);
      }
    }, { threshold, ...(rootMargin ? { rootMargin } : {}) });
    obs.observe(el);
    observerRef.current = obs;
  }, [once, threshold, rootMargin]);

  React.useEffect(() => () => { if (observerRef.current) observerRef.current.disconnect(); }, []);

  return [setRef, inView];
}
