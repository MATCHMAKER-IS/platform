"use client";
/**
 * 共通 SignaturePad。canvas に手書き署名を描き、PNG(dataURL)で取得する。
 * ポインタイベントでマウス・タッチ・ペンに対応。依存なし。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** {@link SignaturePad} の props。 */
export interface SignaturePadProps {
  /** 描画が変わったとき(PNG dataURL)。空なら null。 */
  onChange?: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
  className?: string;
}

/** 手書き署名パッド。`clear()` はクリアボタンで実行。 */
export function SignaturePad({ onChange, width = 400, height = 160, className }: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const dirty = React.useRef(false);

  const ctx = () => canvasRef.current?.getContext("2d") ?? null;

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    const c = ctx(); if (!c) return;
    drawing.current = true;
    const { x, y } = pos(e);
    c.beginPath();
    c.moveTo(x, y);
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const c = ctx(); if (!c) return;
    const { x, y } = pos(e);
    c.lineTo(x, y);
    c.lineWidth = 2;
    c.lineCap = "round";
    c.strokeStyle = "#0f172a";
    c.stroke();
    dirty.current = true;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange?.(dirty.current ? canvasRef.current!.toDataURL("image/png") : null);
  };

  const clear = () => {
    const c = ctx(); if (!c) return;
    c.clearRect(0, 0, width, height);
    dirty.current = false;
    onChange?.(null);
  };

  return (
    <div className={cn("inline-flex flex-col gap-2", className)}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="touch-none rounded-[var(--radius)] border border-[var(--color-border)] bg-white"
      />
      <button type="button" onClick={clear} className="self-start text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">
        クリア
      </button>
    </div>
  );
}
