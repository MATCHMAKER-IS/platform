"use client";
/**
 * 画像アップロードフック。ファイル選択 → 自動縮小(実用サイズ化)→ アップロードを一括で扱う。
 * @packageDocumentation
 */
import * as React from "react";
import { resizeImage } from "../lib/image.js";
import type { FitOptions, ImageFormat } from "@platform/image/geometry";

/** {@link useImageUpload} のオプション。 */
export interface UseImageUploadOptions<T> {
  /** アップロード関数(縮小後の Blob と元 File を受け取り、結果を返す)。 */
  upload: (blob: Blob, file: File) => Promise<T>;
  /** 縮小設定(未指定なら maxWidth/Height 1600・webp)。false で縮小しない。 */
  resize?: (FitOptions & { format?: ImageFormat; quality?: number }) | false;
}

/** 画像アップロードの状態と操作。 */
export interface UseImageUploadResult<T> {
  uploading: boolean;
  error: string | null;
  result: T | null;
  /** プレビュー用 URL(縮小後)。 */
  preview: string | null;
  /** File を処理する(縮小→アップロード)。 */
  select: (file: File) => Promise<void>;
  /** <input type="file"> の onChange に渡す。 */
  onInputChange: (e: { target: { files: FileList | null } }) => void;
  reset: () => void;
}

/** 選択→自動縮小→アップロードを1つにまとめたフック。 */
export function useImageUpload<T = unknown>(options: UseImageUploadOptions<T>): UseImageUploadResult<T> {
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<T | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  const select = React.useCallback(async (file: File) => {
    setError(null); setUploading(true); setResult(null);
    try {
      const cfg = options.resize;
      const blob = cfg === false ? file : await resizeImage(file, { maxWidth: 1600, maxHeight: 1600, format: "webp", quality: 0.85, ...cfg });
      setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
      const r = await options.upload(blob, file);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.upload, options.resize]);

  const onInputChange = React.useCallback((e: { target: { files: FileList | null } }) => {
    const file = e.target.files?.[0];
    if (file) void select(file);
  }, [select]);

  const reset = React.useCallback(() => {
    setResult(null); setError(null);
    setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
  }, []);

  return { uploading, error, result, preview, select, onInputChange, reset };
}
