"use client";
/**
 * 共通 AudioVisualizer。Web Audio の AnalyserNode でリアルタイム波形/バーを描く。
 * マイクの MediaStream か、再生中のメディア要素を入力にできる。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** {@link AudioVisualizer} の props。 */
export interface AudioVisualizerProps {
  /** 可視化するライブ入力(録音中の stream 等)。 */
  stream?: MediaStream | null;
  /** 可視化するメディア要素(再生中の audio/video)。 */
  mediaElement?: HTMLMediaElement | null;
  /** 描画スタイル。 */
  variant?: "bars" | "wave";
  height?: number;
  className?: string;
}

/** リアルタイム音声ビジュアライザ。 */
export function AudioVisualizer({ stream, mediaElement, variant = "bars", height = 80, className }: AudioVisualizerProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const source = stream ?? mediaElement;
    if (!source) return;
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const node = stream
      ? ctx.createMediaStreamSource(stream)
      : ctx.createMediaElementSource(mediaElement!);
    node.connect(analyser);
    if (mediaElement) analyser.connect(ctx.destination); // 要素の音は出力に戻す
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current; if (!canvas) return;
      const c = canvas.getContext("2d"); if (!c) return;
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.fillStyle = "#0f766e";
      if (variant === "bars") {
        analyser.getByteFrequencyData(data);
        const bw = canvas.width / data.length;
        data.forEach((v, i) => {
          const h = (v / 255) * canvas.height;
          c.fillRect(i * bw, canvas.height - h, bw - 1, h);
        });
      } else {
        analyser.getByteTimeDomainData(data);
        c.beginPath();
        data.forEach((v, i) => {
          const x = (i / data.length) * canvas.width;
          const y = (v / 255) * canvas.height;
          i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        });
        c.strokeStyle = "#0f766e";
        c.stroke();
      }
    };
    draw();

    return () => { cancelAnimationFrame(raf); node.disconnect(); void ctx.close(); };
  }, [stream, mediaElement, variant]);

  return <canvas ref={canvasRef} height={height} className={cn("w-full rounded-[var(--radius)] bg-slate-50", className)} />;
}
