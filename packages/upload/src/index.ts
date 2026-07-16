/**
 * `@platform/upload` — アップロード/ダウンロードの HTTP 境界処理。
 *
 * multipart/form-data の受け取り→検証(サイズ・MIME)→`@platform/storage` への保存、
 * およびダウンロード用レスポンス生成を共通化する。ロジックはアプリ、保存先は storage、
 * その受け渡し(境界)をここが担う。
 *
 * @packageDocumentation
 */

import { AppError, ErrorCode, ok, err, type Result } from "@platform/core";
import type { Storage } from "@platform/storage";

/** 保存済みファイルのメタ情報。 */
export interface UploadedFile {
  /** storage 上のキー。 */
  key: string;
  /** 元のファイル名。 */
  name: string;
  /** バイト数。 */
  size: number;
  /** MIME タイプ。 */
  type: string;
}

/** {@link handleUpload} のオプション。 */
export interface UploadOptions {
  /** 保存先。 */
  storage: Storage;
  /** 受け取るフォームフィールド名(既定 "file")。 */
  field?: string;
  /** キーの接頭辞(既定 "uploads")。 */
  keyPrefix?: string;
  /** 1 ファイルの最大バイト数。 */
  maxSizeBytes?: number;
  /** 許可する MIME(前方一致、例: ["image/", "application/pdf"])。 */
  allowedMimeTypes?: string[];
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i) : "";
}

/**
 * multipart リクエストを受け取り、検証してから storage に保存する。
 *
 * @param request FormData を含む Request(Next の Route ハンドラ等)
 * @param options 保存先・制限
 * @returns 保存済みファイルの配列(複数対応)
 *
 * @example
 * ```ts
 * export const POST = handleRoute(async (req) => {
 *   const res = await handleUpload(req, { storage, maxSizeBytes: 5_000_000, allowedMimeTypes: ["image/"] });
 *   if (!res.ok) throw res.error;
 *   return Response.json({ files: res.value });
 * });
 * ```
 */
export async function handleUpload(request: Request, options: UploadOptions): Promise<Result<UploadedFile[]>> {
  const { storage, field = "file", keyPrefix = "uploads", maxSizeBytes, allowedMimeTypes } = options;

  let form: FormData;
  try {
    form = await request.formData();
  } catch (e) {
    return err(new AppError(ErrorCode.VALIDATION, "multipart/form-data として解釈できませんでした", { cause: e }));
  }

  const entries = form.getAll(field).filter((v): v is File => v instanceof File);
  if (entries.length === 0) return err(new AppError(ErrorCode.VALIDATION, `ファイル(${field})が含まれていません`));

  const uploaded: UploadedFile[] = [];
  for (const file of entries) {
    if (maxSizeBytes != null && file.size > maxSizeBytes) {
      return err(new AppError(ErrorCode.VALIDATION, `ファイルサイズが上限(${Math.floor(maxSizeBytes / 1024 / 1024)}MB)を超えています: ${file.name}`));
    }
    if (allowedMimeTypes && !allowedMimeTypes.some((t) => file.type.startsWith(t))) {
      return err(new AppError(ErrorCode.VALIDATION, `許可されていない形式です: ${file.name}(${file.type})`));
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const key = `${keyPrefix}/${crypto.randomUUID()}${extOf(file.name)}`;
    const put = await storage.put(key, bytes, { contentType: file.type });
    if (!put.ok) return put;
    uploaded.push({ key, name: file.name, size: file.size, type: file.type });
  }
  return ok(uploaded);
}

/** {@link serveDownload} のオプション。 */
export interface DownloadOptions {
  /** ダウンロードファイル名。 */
  filename: string;
  /** MIME タイプ(既定 "application/octet-stream")。 */
  contentType?: string;
  /** インライン表示(true)か添付ダウンロード(false、既定)。 */
  inline?: boolean;
}

/**
 * バイト列をダウンロード用のレスポンスに変換する(Content-Disposition 付き)。
 *
 *
 * @param options.filename / contentType / body 返すファイル
 * @returns Response(**`Content-Disposition` を付ける**ので、ブラウザで開かずダウンロードされる)
 */
export function serveDownload(data: Uint8Array, options: DownloadOptions): Response {
  const { filename, contentType = "application/octet-stream", inline = false } = options;
  const disposition = inline ? "inline" : "attachment";
  return new Response(data as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "content-length": String(data.byteLength),
    },
  });
}

/**
 * storage のキーからファイルを取得してダウンロードレスポンスを返す。
 * @param storage 保存先
 * @param key キー
 * @param options ファイル名・MIME・表示方法
 * @returns ダウンロード用 Response の `ok`、取得失敗は `err`
 */
export async function downloadFromStorage(
  storage: Storage,
  key: string,
  options: DownloadOptions,
): Promise<Result<Response>> {
  const res = await storage.get(key);
  if (!res.ok) return res;
  return ok(serveDownload(res.value, options));
}
