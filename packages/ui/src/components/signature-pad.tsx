"use client";
/**
 * 共通 SignaturePad。canvas に手書き署名を描き、PNG(dataURL)で取得する。
 * ポインタイベントでマウス・タッチ・ペンに対応。依存なし。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link SignaturePad} の props。 */
export interface SignaturePadProps {
  /** 描画が変わったとき(PNG dataURL)。空なら null。 */
  onChange?: (dataUrl: string | null) => void;
  /**
   * 保存ボタンを押したとき(PNG dataURL)。**渡すと保存ボタンが出る**。
   *
   * 「描くたびに通知」ではなく「押したときだけ確定」させたい場面向け。
   * 承認画面のように**署名を意図的に確定させたい**ときはこちらを使う。
   */
  onSave?: (dataUrl: string) => void;
  /** 保存ボタンの文言(既定「サインを保存」)。 */
  saveLabel?: string;
  width?: number;
  height?: number;
  className?: string;
}

/** 手書き署名パッド。`clear()` はクリアボタンで実行。 */
export function SignaturePad({ onChange, onSave, saveLabel = "サインを保存", width = 400, height = 160, className }: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const dirty = React.useRef(false);
  // **保存ボタンの活性は state で持つ。** ref だけだと再描画されず、
  // 描いてもボタンが押せないままになる
  const [hasInk, setHasInk] = React.useState(false);

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
    // **線の色も変数から取る。** 直書きすると暗いテーマで見えなくなる
    c.strokeStyle = getComputedStyle(canvasRef.current!).getPropertyValue("--color-fg").trim() || "#0f172a";
    c.stroke();
    dirty.current = true;
    setHasInk(true);
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
    setHasInk(false);
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
      <div className="flex items-center gap-3">
        <button type="button" onClick={clear} className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">
          クリア
        </button>
        {onSave !== undefined && (
          <button
            type="button"
            disabled={!hasInk}
            onClick={() => { if (dirty.current) onSave(canvasRef.current!.toDataURL("image/png")); }}
            className="rounded-[var(--radius)] bg-[var(--color-primary)] px-3 py-1 text-xs text-[var(--color-primary-fg)] disabled:opacity-40"
          >
            {saveLabel}
          </button>
        )}
      </div>
    </div>
  );
}
