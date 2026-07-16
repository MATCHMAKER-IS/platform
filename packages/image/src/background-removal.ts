/**
 * 外部の背景除去 API 連携。remove.bg などの HTTP API を呼び、背景を除去した画像を返す。
 * ローカルの単色背景抜き(@platform/ui の removeBackgroundColor)では対応できない、
 * 複雑背景の切り抜きに使う。
 * @packageDocumentation
 */
import { AppError, ErrorCode, ok, err, type Result } from "@platform/core";

/** 背景除去サービスの抽象。 */
export interface BackgroundRemover {
  /** 画像バイト列を渡し、背景除去後のバイト列を返す。 */
  remove(image: Uint8Array | Blob): Promise<Result<Uint8Array>>;
}

/** {@link createRemoveBgRemover} のオプション。 */
export interface RemoveBgOptions {
  /** remove.bg の API キー。 */
  apiKey: string;
  /** 出力サイズ("auto" 等、既定 "auto")。 */
  size?: string;
  /** エンドポイント上書き。 */
  endpoint?: string;
  /** fetch 実装の注入(テスト用)。 */
  fetch?: typeof fetch;
}

/**
 * remove.bg を使う背景除去。
 *
 * **有料 API**(1 枚ごとに課金)。大量処理の前に料金を確認すること。
 *
 * @param apiKey API キー
 * @param fetchImpl fetch の実装(テスト注入用)
 * @returns 背景除去の実装
 */
export function createRemoveBgRemover(options: RemoveBgOptions): BackgroundRemover {
  const doFetch = options.fetch ?? fetch;
  const endpoint = options.endpoint ?? "https://api.remove.bg/v1.0/removebg";
  return {
    async remove(image) {
      try {
        const form = new FormData();
        const blob = image instanceof Blob ? image : new Blob([image as unknown as BlobPart]);
        form.append("image_file", blob);
        form.append("size", options.size ?? "auto");
        const res = await doFetch(endpoint, { method: "POST", headers: { "X-Api-Key": options.apiKey }, body: form });
        if (!res.ok) {
          return err(new AppError(ErrorCode.EXTERNAL, `背景除去 API エラー(${res.status})`));
        }
        return ok(new Uint8Array(await res.arrayBuffer()));
      } catch (e) {
        return err(new AppError(ErrorCode.EXTERNAL, "背景除去 API 呼び出しに失敗しました", { cause: e }));
      }
    },
  };
}

/** {@link createBackgroundRemover} のオプション(任意 API を汎用連携)。 */
export interface GenericRemoverOptions {
  endpoint: string;
  headers?: Record<string, string>;
  /** 画像を送るフィールド名(既定 "image_file")。 */
  fieldName?: string;
  fetch?: typeof fetch;
}

/**
 * 任意の背景除去 API を呼ぶ汎用アダプタ。
 *
 * **サービスは差し替わる**(精度・価格で選び直す)。ここを通すことで、
 * アプリ側のコードは変えずに済む。
 *
 * @param options.endpoint / apiKey / fieldName API の仕様
 * @returns 背景除去の実装
 */
export function createBackgroundRemover(options: GenericRemoverOptions): BackgroundRemover {
  const doFetch = options.fetch ?? fetch;
  return {
    async remove(image) {
      try {
        const form = new FormData();
        const blob = image instanceof Blob ? image : new Blob([image as unknown as BlobPart]);
        form.append(options.fieldName ?? "image_file", blob);
        const res = await doFetch(options.endpoint, { method: "POST", headers: options.headers, body: form });
        if (!res.ok) return err(new AppError(ErrorCode.EXTERNAL, `背景除去 API エラー(${res.status})`));
        return ok(new Uint8Array(await res.arrayBuffer()));
      } catch (e) {
        return err(new AppError(ErrorCode.EXTERNAL, "背景除去 API 呼び出しに失敗しました", { cause: e }));
      }
    },
  };
}
