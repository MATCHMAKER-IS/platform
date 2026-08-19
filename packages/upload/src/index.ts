/**
 * `@platform/upload` — アップロード/ダウンロードの HTTP 境界処理。
 *
 * multipart/form-data の受け取り→検証(サイズ・MIME)→`@platform/storage` への保存、
 * およびダウンロード用レスポンス生成を共通化する。ロジックはアプリ、保存先は storage、
 * その受け渡し(境界)をここが担う。
 *
 * @packageDocumentation
 */

import { hasJpegExif, matchesDeclaredType } from "@platform/bytes";
import { AppError, ErrorCode, ok, err, type Result } from "@platform/core";
import type { Storage } from "@platform/storage";

/** 保存済みファイルのメタ情報。 */
export interface UploadedFile {
  /**
   * 名乗った種別と中身が一致するか。
   *
   * **`false` でも保存はされます**——実行は `attachment` + `nosniff` で防げており、
   * 拒むと**正しいファイルまで通らなくなる**。
   * 「PDF のつもりで開いたら壊れている」を早く気づくための情報です。
   */
  typeMatches: boolean;
  /**
   * JPEG に EXIF（撮影情報）が残っているか。
   *
   * **`true` でも保存はされます。** 消すには画像処理が要るので、
   * **気づくための情報**です——`@platform/image` で変換すれば落ちます。
   *
   * **GPS が入っているかまでは見ていません**（EXIF の領域があるかだけ）。
   */
  hasExif: boolean;
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
  /**
   * 1 ファイルの最大バイト数(**既定 25MB**)。
   *
   * **既定を無制限にしない。** 指定を忘れると、いくらでも受け取って
   * ディスクを埋められる。大きいものを扱うなら明示的に上げること。
   */
  maxSizeBytes?: number;
  /**
   * 許可する MIME(前方一致、例: `["image/", "application/pdf"]`)。
   *
   * **`file.type` はクライアントが送る値なので偽装できる。**
   * 実行ファイルを `image/png` と申告すればこの検査は通る。
   * ここは「間違って別の形式を選んだ」を弾くためのもので、
   * **攻撃を防ぐものではない**。
   *
   * 本当に中身を確かめるなら、保存後に先頭バイト(マジックナンバー)を見ること。
   * 少なくとも**保存先で実行されない**ようにしておく
   * (`Content-Disposition: attachment` で返す。{@link serveDownload} はそうしている)。
   */
  allowedMimeTypes?: string[];
}

/**
 * ファイル名から拡張子を取り出す。
 *
 * **保存先の鍵に混ぜるので、そのまま使わない。**
 * `evil./../../etc/passwd` のような名前から `./etc/passwd` が返り、
 * 鍵にパス区切りが混入する(保存先が階層を作れると任意の場所に書ける)。
 * 2026-08 に発見。
 *
 * 英数字だけを許し、長さも切る。**判断できない名前は拡張子なし**にする
 * (拡張子は「開くときの手がかり」でしかなく、無くても保存はできる)。
 *
 * @param name 元のファイル名
 * @returns `.pdf` のような拡張子、または空文字
 */
function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  if (i < 0) return "";
  const ext = name.slice(i + 1);
  // **英数字のみ・16 文字まで。** これを外れるものは拡張子とみなさない
  if (!/^[A-Za-z0-9]{1,16}$/.test(ext)) return "";
  return `.${ext.toLowerCase()}`;
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
/**
 * 1 ファイルの既定の上限(25MB)。
 *
 * **メール添付の上限に合わせた値。** これを超えるものは、
 * そのままでは他所へ渡せないことが多い。
 * 大きいファイルを扱う画面では明示的に上げること。
 */
export const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * アップロードを受け取り、保管して**結果を返す**。
 *
 * 【この関数がやること】
 * 件数・サイズ・種別を確かめ、**推測できない key** で保管します。
 * **元のファイル名は保管先の名前にしません**——推測して他人のファイルを
 * 取られないためです（名前は別に持ち、ダウンロード時に付け直します）。
 *
 * 【拒まないこと】
 * **種別が名乗りと違っても、EXIF が残っていても保存します。**
 * 結果の `typeMatches` / `hasExif` で分かるので、**呼び出し側が記録**してください
 * ——拒むと、**正しいファイルまで通らなくなります**（実行は
 * `Content-Disposition: attachment` と `nosniff` で防いでいます）。
 *
 * @param request `multipart/form-data` の要求
 * @param options 保管先・上限・key の接頭辞
 * @returns 保管したファイルの一覧（`key` / `name` / `size` / `type` / `typeMatches` / `hasExif`）
 */
export async function handleUpload(request: Request, options: UploadOptions): Promise<Result<UploadedFile[]>> {
  // **サイズの既定を持たせる。** 指定を忘れても無制限にはしない
  const { storage, field = "file", keyPrefix = "uploads", maxSizeBytes = DEFAULT_MAX_UPLOAD_BYTES, allowedMimeTypes } = options;

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

    // **名乗った種別と中身が食い違うなら知らせる。** `file.type` は
    // **ブラウザが名乗るだけ**で詐称できる——`.pdf` という名前の
    // 実行ファイルを「PDF です」と言って送れる。
    //
    // **拒まずに警告する。** 実行は `Content-Disposition: attachment` と
    // `X-Content-Type-Options: nosniff` で防げているので、ここで弾く必要はない。
    // **拒むと、正しいファイルまで通らなくなる**危険の方が大きい
    // (知らない形式は `sniffMimeType` が `undefined` を返して通す)。
    //
    // **xlsx / docx / pptx は中身が zip に見える**ので許してある。
    const typeMatches = matchesDeclaredType(bytes, file.type, { allowZipBased: true });

    // **EXIF が残っていないか。** スマホで撮った写真には
    // **撮影日時・機種・GPS の位置情報**が入る——領収書を撮ってアップロードすると、
    // **どこで撮ったかが残る**。持ち出されたら分かってしまう。
    //
    // **ここでは消さない**(消すには画像処理が要り、`sharp` は重い依存)。
    // **気づけるようにする**のが目的で、消すなら `@platform/image` で変換する。
    const hasExif = hasJpegExif(bytes);
    const key = `${keyPrefix}/${crypto.randomUUID()}${extOf(file.name)}`;
    const put = await storage.put(key, bytes, { contentType: file.type });
    if (!put.ok) return put;
    // **表示名は長さを切る。**
    // そのまま台帳に入り、一覧とダウンロード名に使われる。
    // 極端に長い名前は画面を崩し、`Content-Disposition` にも載る。
    // **中身は変えない**(利用者が付けた名前は尊重する)
    const name = file.name.length > 255 ? file.name.slice(0, 255) : file.name;
    uploaded.push({ key, name, size: file.size, type: file.type, typeMatches, hasExif });
  }
  return ok(uploaded);
}

/** {@link serveDownload} のオプション。 */
export interface DownloadOptions {
  /** ダウンロードファイル名。 */
  filename: string;
  /** MIME タイプ(既定 "application/octet-stream")。 */
  contentType?: string;
  /**
   * インライン表示(true)か添付ダウンロード(false、**既定**)。
   *
   * **利用者がアップロードしたファイルに `true` を使わない。**
   * ブラウザがその場で開くので、HTML や SVG を上げられると
   * **こちらのドメインでスクリプトが動く**(保存されたクッキーも読める)。
   * `image/png` と申告された HTML でも、ブラウザは中身を見て判断することがある。
   *
   * `true` にしてよいのは**こちらが生成したもの**(帳票 PDF など)だけ。
   */
  inline?: boolean;
}

/**
 * バイト列をダウンロード用のレスポンスに変換する(Content-Disposition 付き)。
 *
 *
 * @param data 返す中身
 * @param options.filename ファイル名（**日本語は自動でエンコードします**）
 * @param options.contentType MIME 種別
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
