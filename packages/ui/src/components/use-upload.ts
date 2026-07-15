"use client";
/** ファイルアップロードを進捗付きで行うフック(fetch は進捗が取れないため XHR を使用)。 */
import * as React from "react";

export interface UploadResult {
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
}

export interface UseUploadOptions {
  /** 送信先 URL。 */
  url: string;
  /** フォームフィールド名(既定 "file")。 */
  field?: string;
  /** 追加ヘッダ(CSRF トークン等)。 */
  headers?: Record<string, string>;
}

export function useUpload({ url, field = "file", headers = {} }: UseUploadOptions) {
  const [progress, setProgress] = React.useState(0);
  const [uploading, setUploading] = React.useState(false);

  const upload = React.useCallback(
    (files: File[]) =>
      new Promise<UploadResult>((resolve) => {
        const form = new FormData();
        for (const f of files) form.append(field, f);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onloadstart = () => { setUploading(true); setProgress(0); };
        xhr.onloadend = () => setUploading(false);
        xhr.onerror = () => resolve({ ok: false, status: 0, error: "通信に失敗しました" });
        xhr.onload = () => {
          let data: unknown; try { data = JSON.parse(xhr.responseText); } catch { data = xhr.responseText; }
          resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
        };
        xhr.send(form);
      }),
    [url, field, JSON.stringify(headers)], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { upload, progress, uploading };
}
