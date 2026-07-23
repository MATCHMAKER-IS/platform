"use client";
/**
 * 対話トリミング。画像上をドラッグして範囲選択し、切り抜いた Blob を返す。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { rectFromPoints, displayToNaturalRect, type Rect } from "../lib/crop";
import { cropImage } from "../lib/image";
import type { ImageFormat } from "@platform/image/geometry";
import { Button } from "./button";

/** {@link ImageCropper} の props。 */
export interface ImageCropperProps {
  /** 画像(Blob か URL)。 */
  src: Blob | string;
  /** 切り抜き実行時に呼ばれる(切り抜き後の Blob と自然px矩形)。 */
  onCrop?: (blob: Blob, rect: Rect) => void;
  format?: ImageFormat;
  quality?: number;
  className?: string;
}

/** ドラッグで範囲選択して切り抜くコンポーネント。 */
/**
 * 画像の切り抜き。
 *
 * 顔写真やロゴの位置を合わせるのに使う。
 * **縦横比を固定**すると、後の表示が崩れない。
 */
export function ImageCropper({ src, onCrop, format = "png", quality, className }: ImageCropperProps) {
  const url = React.useMemo(() => (typeof src === "string" ? src : URL.createObjectURL(src)), [src]);
  React.useEffect(() => () => { if (typeof src !== "string") URL.revokeObjectURL(url); }, [src, url]);

  const imgRef = React.useRef<HTMLImageElement>(null);
  const [start, setStart] = React.useState<{ x: number; y: number } | null>(null);
  const [sel, setSel] = React.useState<Rect | null>(null);

  const relative = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent) => { const p = relative(e); setStart(p); setSel({ left: p.x, top: p.y, width: 0, height: 0 }); };
  const onMove = (e: React.PointerEvent) => { if (!start) return; const p = relative(e); setSel(rectFromPoints(start.x, start.y, p.x, p.y)); };
  const onUp = () => setStart(null);

  const doCrop = async () => {
    const img = imgRef.current;
    if (!img || !sel || sel.width < 4 || sel.height < 4) return;
    const rect = displayToNaturalRect(sel, img.clientWidth, img.clientHeight, img.naturalWidth, img.naturalHeight);
    const blob = await cropImage(await (await fetch(url)).blob(), rect, format, quality);
    onCrop?.(blob, rect);
  };

  return (
    <div className={cn("inline-flex flex-col gap-2", className)}>
      <div className="relative inline-block touch-none select-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        <img ref={imgRef} src={url} alt="crop" draggable={false} className="block max-w-full rounded-[var(--radius)]" />
        {sel && sel.width > 0 && (
          <div className="pointer-events-none absolute border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/10"
            style={{ left: sel.left, top: sel.top, width: sel.width, height: sel.height }} />
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={doCrop} disabled={!sel || sel.width < 4}>切り抜く</Button>
        <span className="text-sm text-[var(--color-muted)]">{sel && sel.width > 4 ? `${Math.round(sel.width)}×${Math.round(sel.height)}` : "ドラッグで範囲選択"}</span>
      </div>
    </div>
  );
}
