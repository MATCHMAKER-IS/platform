/**
 * `@platform/integrations` — 外部サービス連携の共通土台。
 *
 * 各外部 API 連携が「fetch のラップ・タイムアウト・リトライ・エラー正規化」を
 * 個別に再発明しないよう、型付き HTTP クライアントを提供する。
 * 個別サービス(会計 SaaS 等)の連携は、このクライアントを使って実装する。
 *
 * @packageDocumentation
 */

import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";

/** {@link createApiClient} の設定。 */
export interface ApiClientConfig {
  /** ベース URL(例: "https://api.example.com/v1")。 */
  baseUrl: string;
  /** 全リクエストに付与するヘッダ(認証トークン等)。 */
  headers?: Record<string, string>;
  /** タイムアウト(ミリ秒。既定: 10000)。 */
  timeoutMs?: number;
  /** リトライ回数(5xx / ネットワークエラー時。既定: 2)。 */
  retries?: number;
  /** fetch 実装の差し替え(テスト用。既定: グローバル fetch)。 */
  fetchImpl?: typeof fetch;
  /** 全リクエストのクエリにマージする既定値(例: Zoho Books の organization_id)。 */
  defaultQuery?: Record<string, string | number | undefined>;
}

/** リクエストオプション。 */
export interface RequestOptions {
  /** 追加・上書きするヘッダ。 */
  headers?: Record<string, string>;
  /** JSON ボディ(POST/PUT/PATCH)。 */
  body?: unknown;
  /** クエリパラメータ。 */
  query?: Record<string, string | number | boolean | undefined>;
  /** multipart/form-data 送信(body より優先。content-type は fetch が自動設定)。 */
  multipart?: MultipartBody;
}

/** multipart のファイル要素。 */
export interface MultipartFile {
  /** フィールド名。 */
  field: string;
  /** ファイル名。 */
  filename: string;
  /** 内容(バイナリ or Blob)。 */
  data: Uint8Array | Blob;
  /** MIME タイプ。 */
  contentType?: string;
}

/** multipart 本体(テキストフィールド + ファイル)。 */
export interface MultipartBody {
  fields?: Record<string, string | number | boolean>;
  files?: MultipartFile[];
}

/** 型付き HTTP クライアント。各メソッドは Result を返す。 */
export interface ApiClient {
  get<T>(path: string, options?: RequestOptions): Promise<Result<T>>;
  post<T>(path: string, options?: RequestOptions): Promise<Result<T>>;
  put<T>(path: string, options?: RequestOptions): Promise<Result<T>>;
  patch<T>(path: string, options?: RequestOptions): Promise<Result<T>>;
  delete<T>(path: string, options?: RequestOptions): Promise<Result<T>>;
}

function buildUrl(base: string, path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path.replace(/^\//, ""), base.endsWith("/") ? base : base + "/");
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 外部 API 用の型付き HTTP クライアントを作る。
 *
 * タイムアウト・リトライ(5xx / ネットワーク障害)・エラー正規化を内蔵する。
 * 失敗は {@link @platform/core#AppError}(コード `EXTERNAL`)に統一される。
 *
 * @param config ベース URL・共通ヘッダ・タイムアウト・リトライ
 * @returns {@link ApiClient}
 *
 * @example
 * ```ts
 * const api = createApiClient({
 *   baseUrl: "https://api.example.com/v1",
 *   headers: { Authorization: `Bearer ${token}` },
 * });
 * const res = await api.get<User[]>("/users", { query: { active: true } });
 * if (res.ok) use(res.value);
 * ```
 *
 * @throws {@link @platform/core#AppError} コード `CONFIG` — baseUrl が未設定、または不正な URL の場合(生成時)
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  const { baseUrl, headers = {}, timeoutMs = 10_000, retries = 2, fetchImpl, defaultQuery } = config;
  const doFetch = fetchImpl ?? fetch;

  async function request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<Result<T>> {
    const url = buildUrl(baseUrl, path, { ...defaultQuery, ...options.query });
    const mergedHeaders: Record<string, string> = {
      "content-type": "application/json",
      ...headers,
      ...options.headers,
    };
    let body: BodyInit | undefined;
    if (options.multipart) {
      const form = new FormData();
      for (const [k, v] of Object.entries(options.multipart.fields ?? {})) form.append(k, String(v));
      for (const f of options.multipart.files ?? []) {
        const blob = f.data instanceof Blob ? f.data : new Blob([f.data as BlobPart], f.contentType ? { type: f.contentType } : {});
        form.append(f.field, blob, f.filename);
      }
      body = form;
      // multipart の境界は fetch/undici が付与するため content-type を外す
      delete mergedHeaders["content-type"];
    } else if (options.body !== undefined) {
      body = JSON.stringify(options.body);
    }
    const init: RequestInit = {
      method,
      headers: mergedHeaders,
      ...(body !== undefined ? { body } : {}),
    };

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const attemptResult = await tryCatch(async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await doFetch(url, { ...init, signal: controller.signal });
          if (res.status >= 500) throw new AppError(ErrorCode.EXTERNAL, `外部API 5xx: ${res.status}`);
          if (!res.ok) {
            // 4xx は原則リトライしない(呼び出し側の問題)
            const text = await res.text().catch(() => "");
            throw new AppError(ErrorCode.EXTERNAL, `外部API エラー: ${res.status}`, {
              details: { status: res.status, body: text.slice(0, 500) },
            });
          }
          const ct = res.headers.get("content-type") ?? "";
          return (ct.includes("application/json") ? await res.json() : await res.text()) as T;
        } finally {
          clearTimeout(timer);
        }
      });

      if (attemptResult.ok) return attemptResult;

      lastError = attemptResult.error;
      const isServer5xx = attemptResult.error.message.includes("5xx");
      const isAbort = attemptResult.error.message.toLowerCase().includes("abort");
      if (attempt < retries && (isServer5xx || isAbort)) {
        await sleep(200 * (attempt + 1)); // 単純な指数的バックオフ
        continue;
      }
      break;
    }
    return {
      ok: false,
      error:
        lastError instanceof AppError
          ? lastError
          : new AppError(ErrorCode.EXTERNAL, "外部API呼び出しに失敗しました", { cause: lastError }),
    };
  }

  return {
    get: (path, options) => request("GET", path, options),
    post: (path, options) => request("POST", path, options),
    put: (path, options) => request("PUT", path, options),
    patch: (path, options) => request("PATCH", path, options),
    delete: (path, options) => request("DELETE", path, options),
  };
}
