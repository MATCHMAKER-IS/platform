"use client";
/**
 * パララックス/スクロール表示アニメーション。@platform/ui の motion ヘルパーを使う。
 * - Parallax: スクロールに応じて背景をゆっくり動かす。
 * - Reveal: 画面に入ったらフェード＆スライドイン（IntersectionObserver）。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { parallaxOffset, revealStyle, transitionPresets } from "../lib/motion";

/** {@link Parallax} の props。 */
export interface ParallaxProps {
  children: React.ReactNode;
  /** 移動係数（0.1〜0.5 程度）。 */
  speed?: number;
  className?: string;
}

/** スクロール連動パララックス。 */
export function Parallax({ children, speed = 0.3, className }: ParallaxProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    const handch = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = (globalThis as unknown as { innerHeight: number }).innerHeight;
      const scrollY = (globalThis as unknown as { scrollY: number }).scrollY;
      setOffset(parallaxOffset(scrollY, scrollY + rect.top, vh, speed));
    };
    handch();
    const w = globalThis as unknown as { addEventListener: (e: string, cb: () => void, o?: unknown) => void; removeEventListener: (e: string, cb: () => void) => void };
    w.addEventListener("scroll", handch, { passive: true });
    w.addEventListener("resize", handch);
    return () => {
      w.removeEventListener("scroll", handch);
      w.removeEventListener("resize", handch);
    };
  }, [speed]);

  return (
    <div ref={ref} className={cn("overflow-hidden", className)}>
      <div style={{ transform: `translateY(${offset}px)`, willChange: "transform" }}>{children}</div>
    </div>
  );
}

/** {@link Reveal} の props。 */
export interface RevealProps {
  children: React.ReactNode;
  /** 移動距離（px）。 */
  distance?: number;
  axis?: "x" | "y";
  /** 一度表示したら固定する。 */
  once?: boolean;
  className?: string;
}

/** 画面に入ったらフェードイン。 */
export function Reveal({ children, distance = 16, axis = "y", once = true, className }: RevealProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    const IO = (globalThis as unknown as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
    if (!el || !IO) {
      setVisible(true);
      return;
    }
    const obs = new IO((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) obs.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [once]);

  const style = revealStyle(visible, { distance, axis });
  return (
    <div ref={ref} className={className} style={{ ...style, transition: transitionPresets.slow }}>
      {children}
    </div>
  );
}
