"use client";
/** 手書きサイン入力。キャンバスにポインタで署名を描き、PNG data URL として onSave で返す。 */
import * as React from "react";
import { Button } from "@platform/ui";

export function SignaturePad({ onSave, width = 400, height = 160 }: { onSave: (image: string) => void; width?: number; height?: number }) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  const drawing = React.useRef(false);
  const [dirty, setDirty] = React.useState(false);

  const ctx = () => ref.current?.getContext("2d") ?? null;
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = ref.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const c = ctx();
    if (!c) return;
    const p = pos(e);
    c.beginPath();
    c.moveTo(p.x, p.y);
    ref.current!.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const c = ctx();
    if (!c) return;
    const p = pos(e);
    c.lineWidth = 2.5;
    c.lineCap = "round";
    c.strokeStyle = "#111827";
    c.lineTo(p.x, p.y);
    c.stroke();
    setDirty(true);
  };
  const end = () => { drawing.current = false; };

  const clear = () => {
    const c = ctx();
    if (c && ref.current) c.clearRect(0, 0, ref.current.width, ref.current.height);
    setDirty(false);
  };
  const save = () => { if (ref.current && dirty) onSave(ref.current.toDataURL("image/png")); };

  return (
    <div className="inline-block">
      <canvas ref={ref} width={width} height={height} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} className="touch-none rounded border border-neutral-300 bg-white" />
      <div className="mt-2 flex gap-2">
        <Button type="button" onClick={clear} className="rounded border border-neutral-300 px-3 py-1 text-xs">消去</Button>
        <Button type="button" onClick={save} disabled={!dirty} className="rounded bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-40">サインを保存</Button>
      </div>
    </div>
  );
}
