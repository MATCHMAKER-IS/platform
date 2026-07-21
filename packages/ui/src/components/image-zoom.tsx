"use client";
/**
 * 画像ズームビューア。ホイール/ピンチで拡大、ドラッグで移動。
 *
 * 業務では**添付画像を細部まで確認したい**場面が多い(領収書の但し書き、図面の寸法、
 * 現場写真の傷)。ダウンロードして別アプリで開かせるのは手間なので、画面で拡大できるようにする。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { ZOOM_RESET, clampPan, zoomAt, clampScale, formatScale, type ZoomState, type ZoomLimits } from "../lib/zoom";
import { Button } from "./button";

/** {@link ImageZoom} の props。 */
export interface ImageZoomProps {
  /** 画像(Blob か URL)。 */
  src: Blob | string;
  alt?: string;
  /** 表示枠の高さ(px・既定 360)。 */
  height?: number;
  /** 拡大率の制限。 */
  limits?: ZoomLimits;
  /** 拡大率が変わったときに呼ばれる。 */
  onScaleChange?: (scale: number) => void;
  /** 操作ボタンを隠す(ホイールとドラッグだけにする)。 */
  hideControls?: boolean;
  className?: string;
}

/** 1 段階の拡大率。 */
const STEP = 1.4;

/**
 * 画像ズームビューア。
 *
 * @remarks
 * **ホイールはカーソル位置を中心に寄る**(枠の中心だと見たい箇所が逃げる)。
 * 等倍では動かせない(拡大していないのに動くと「画像が消えた」になる)。
 *
 * @example
 * ```tsx
 * <ImageZoom src={blob} alt="領収書" height={400} />
 * ```
 */
export function ImageZoom({ src, alt = "", height = 360, limits, onScaleChange, hideControls = false, className }: ImageZoomProps) {
  const url = React.useMemo(() => (typeof src === "string" ? src : URL.createObjectURL(src)), [src]);
  React.useEffect(() => () => { if (typeof src !== "string") URL.revokeObjectURL(url); }, [src, url]);

  const boxRef = React.useRef<HTMLDivElement>(null);
  const [state, setState] = React.useState<ZoomState>(ZOOM_RESET);
  const dragRef = React.useRef<{ x: number; y: number } | null>(null);

  const view = () => {
    const el = boxRef.current;
    return { width: el?.clientWidth ?? 1, height: el?.clientHeight ?? 1 };
  };

  const update = (next: ZoomState) => {
    setState(next);
    onScaleChange?.(next.scale);
  };

  function onWheel(e: React.WheelEvent) {
    const el = boxRef.current;
    if (!el) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    // 枠の中心からのカーソル位置
    const cursor = { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
    update(zoomAt(state, e.deltaY < 0 ? STEP : 1 / STEP, cursor, view(), limits));
  }

  function onPointerDown(e: React.PointerEvent) {
    if (state.scale <= 1) return; // 等倍では動かさない
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX - state.x, y: e.clientY - state.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const v = view();
    update(clampPan({ scale: state.scale, x: e.clientX - d.x, y: e.clientY - d.y }, v.width, v.height));
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function step(factor: number) {
    update(zoomAt(state, factor, { x: 0, y: 0 }, view(), limits));
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={boxRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onDoubleClick={() => update(ZOOM_RESET)}
        className="relative w-full overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] touch-none select-none"
        style={{ height, cursor: state.scale > 1 ? (dragRef.current ? "grabbing" : "grab") : "zoom-in" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          draggable={false}
          className="absolute left-1/2 top-1/2 max-h-full max-w-full"
          style={{
            transform: `translate(-50%, -50%) translate(${state.x}px, ${state.y}px) scale(${state.scale})`,
            transformOrigin: "center",
            transition: dragRef.current ? "none" : "transform .08s",
          }}
        />
      </div>

      {!hideControls && (
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => step(1 / STEP)} disabled={state.scale <= clampScale(0, limits)}>
            −
          </Button>
          <Button size="sm" variant="secondary" onClick={() => step(STEP)} disabled={state.scale >= (limits?.max ?? 8)}>
            ＋
          </Button>
          <Button size="sm" variant="ghost" onClick={() => update(ZOOM_RESET)} disabled={state.scale === 1 && state.x === 0 && state.y === 0}>
            等倍に戻す
          </Button>
          <span className="ml-auto text-xs text-[var(--color-muted)] tabular-nums">{formatScale(state.scale)}</span>
        </div>
      )}
    </div>
  );
}
