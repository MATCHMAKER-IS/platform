/**
 * `@platform/bytes` — **base64・hex・バイナリの相互変換**（依存ゼロ）。
 *
 * 【なぜ要るか】
 * 2026-08 の時点で **12 パッケージ・17 ファイル**が base64 を自前で扱っており、
 * **やり方がばらばら**でした:
 *
 * - `Buffer.from(x).toString("base64")` … **Node 専用**。ブラウザで落ちる
 * - `btoa(x)` … **日本語で例外**（`Invalid character`）。Latin-1 しか扱えない
 * - `btoa(unescape(encodeURIComponent(x)))` … 動くが **`unescape` は非推奨**
 *
 * ここに寄せると、**どこで動かしても同じ結果**になります。
 *
 * 【base64 と base64url の違い】
 * 標準の base64 は `+` `/` `=` を使います。**URL やファイル名に入れると壊れる**ので、
 * その場合は `base64url`（`-` `_`、パディング無し）を使ってください。
 * JWT・WebAuthn・OAuth の `code_challenge` はすべて base64url です。
 *
 * 【使い分け】
 *
 * | やりたいこと | 使うもの |
 * |---|---|
 * | 文字列を base64 に | {@link encodeBase64} |
 * | base64 を文字列に戻す | {@link decodeBase64} |
 * | URL に入れる | {@link encodeBase64Url} |
 * | ファイルの中身（バイナリ） | {@link bytesToBase64} / {@link base64ToBytes} |
 * | 署名やハッシュの比較 | {@link bytesToHex} / {@link hexToBytes} |
 *
 * @packageDocumentation
 */

/**
 * 文字列をバイト列にする（UTF-8）。
 *
 * **日本語も絵文字も扱えます。** `btoa` が落ちるのは、
 * 文字列をバイト列に直さずそのまま base64 にしようとするためです。
 *
 * @param text 文字列
 * @returns バイト列
 */
export function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * バイト列を文字列にする（UTF-8）。
 *
 * **壊れたバイト列は例外を投げず、`U+FFFD`（&#xFFFD;）に置き換えます。**
 * 途中で切れた添付ファイルを表示しようとしたときに、
 * 画面ごと落ちるより「読めない文字」が出る方が扱いやすいためです。
 *
 * @param bytes バイト列
 * @returns 文字列
 */
export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * バイト列を base64 にする。
 *
 * **Node でもブラウザでも動きます。** `Buffer` があればそちらを使い、
 * 無ければ 1 バイトずつ組み立てます。
 *
 * @param bytes バイト列
 * @returns base64 文字列（`+` `/` `=` を含む）
 */
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  // **`String.fromCharCode(...bytes)` は使わない。**
  // 引数が多すぎると `RangeError: Maximum call stack size exceeded` で落ちる
  // ——数 MB のファイルで実際に起きる。1 文字ずつ足す方が遅いが確実。
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * base64 をバイト列に戻す。
 *
 * **壊れた入力では例外を投げます**（`decodeBase64` は `undefined` を返します）。
 * バイナリを扱う場面では「壊れていた」ことを握りつぶすと、
 * **後で復元できないファイルを保存する**ことになるためです。
 *
 * @param base64 base64 文字列（base64url も受け付ける）
 * @returns バイト列
 * @throws base64 として解釈できない場合
 */
export function base64ToBytes(base64: string): Uint8Array {
  // **base64url も受ける。** `-` `_` を標準の文字へ戻し、パディングを補う
  const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(padded, "base64");
    // **Node は不正な文字を黙って捨てる。** 長さで検算する
    if (buf.length === 0 && padded.replace(/=/g, "").length > 0) {
      throw new Error("base64 として解釈できません");
    }
    return new Uint8Array(buf);
  }
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * 文字列を base64 にする（UTF-8 経由）。
 *
 * **`btoa` の代わりに使ってください。** `btoa("経費")` は例外を投げますが、
 * これは `"57WM6LK7"` を返します。
 *
 * @param text 文字列
 * @returns base64 文字列
 */
export function encodeBase64(text: string): string {
  return bytesToBase64(textToBytes(text));
}

/**
 * base64 を文字列に戻す。
 *
 * **壊れていれば `undefined` を返します**（例外を投げません）。
 * 外から来た値を扱う場面が多いので、`try/catch` を書き忘れても落ちない形にしています。
 *
 * @param base64 base64 文字列
 * @returns 文字列。解釈できなければ `undefined`
 */
export function decodeBase64(base64: string): string | undefined {
  try {
    return bytesToText(base64ToBytes(base64));
  } catch {
    return undefined;
  }
}

/**
 * バイト列を base64url にする。
 *
 * **URL・ファイル名・JWT に入れるならこちら。**
 * 標準の base64 は `+` `/` `=` を含み、**URL に入れると壊れます**
 * （`+` が空白になる、`/` がパスの区切りになる）。
 *
 * @param bytes バイト列
 * @returns base64url 文字列（パディング無し）
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * 文字列を base64url にする。
 *
 * @param text 文字列
 * @returns base64url 文字列
 */
export function encodeBase64Url(text: string): string {
  return bytesToBase64Url(textToBytes(text));
}

/**
 * base64url を文字列に戻す。
 *
 * @param base64url base64url 文字列
 * @returns 文字列。解釈できなければ `undefined`
 */
export function decodeBase64Url(base64url: string): string | undefined {
  return decodeBase64(base64url);
}

/**
 * バイト列を 16 進文字列にする。
 *
 * **署名やハッシュの比較に使います。** base64 より長くなりますが、
 * **目で見て桁を数えられる**ので、ログに出すならこちらが扱いやすい。
 *
 * @param bytes バイト列
 * @returns 小文字の 16 進文字列
 */
export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/**
 * 16 進文字列をバイト列に戻す。
 *
 * **大文字小文字は問いません。** 奇数長や 16 進でない文字は例外にします
 * ——署名の比較で使うので、**黙って途中まで読むと通ってしまう**危険があります。
 *
 * @param hex 16 進文字列
 * @returns バイト列
 * @throws 16 進として解釈できない場合
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("16 進文字列の長さが奇数です");
  if (!/^[0-9a-fA-F]*$/.test(hex)) throw new Error("16 進でない文字が含まれています");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * 2 つのバイト列が同じかを、**時間を一定にして**比べる。
 *
 * **署名やトークンの比較に使ってください。** 普通の比較（`===` や `every`）は
 * **違いが見つかった時点で止まる**ので、応答時間の差から
 * 「何文字目まで合っていたか」が漏れます（タイミング攻撃）。
 *
 * **長さが違えば即座に false** を返します——長さは秘密ではないためです。
 *
 * 【Node の `crypto.timingSafeEqual` との使い分け】
 * **サーバ側だけで動くなら Node のものを使ってください**——C 実装で確実です
 * (基盤では 14 箇所が使っています: webhook の署名検証・OTP・API キーなど)。
 *
 * こちらは**ブラウザでも動く**版です。**Node のものは長さが違うと例外を投げる**ので、
 * 呼ぶ前に長さを比べる必要がありますが、こちらは `false` を返します。
 *
 * @param a バイト列
 * @param b バイト列
 * @returns 同じなら true
 */
export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/**
 * バイト数を人が読める形にする。
 *
 * **1024 基準**（KiB）です。ストレージの表示は 1000 基準のことがあるので、
 * **「10MB まで」と案内して 10,000,000 バイトで弾く**ような食い違いに注意してください
 * ——`@platform/utils` の `formatBytes` は `base` を選べます。
 *
 * @param bytes バイト数
 * @returns 例: `"1.5 MB"`
 */
export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

/**
 * バイト列の**先頭を見て**ファイルの種類を推測する。
 *
 * 【なぜ要るか】
 * アップロードの `Content-Type` は**送る側が名乗るだけ**で、詐称できます。
 * `.pdf` という名前の実行ファイルを「PDF です」と言って送れます。
 *
 * **保存を拒むためではありません**（`Content-Disposition: attachment` と
 * `X-Content-Type-Options: nosniff` で実行は防げています）。
 * **「PDF のつもりで開いたら壊れている」を早く気づく**ためのものです。
 *
 * 【限界】
 * **先頭の数バイトしか見ません。** ここが合っていても、
 * **中身が壊れていないことは保証しません**。
 * また **ZIP を土台にした形式**（xlsx / docx / pptx）は
 * すべて `application/zip` に見えます——中を開くまで区別できません。
 *
 * @param bytes ファイルの先頭（**16 バイトあれば足ります**）
 * @returns 分かれば MIME 種別。分からなければ `undefined`
 */
export function sniffMimeType(bytes: Uint8Array): string | undefined {
  const starts = (...sig: number[]): boolean =>
    sig.every((b, i) => bytes[i] === b);

  // PDF: "%PDF"
  if (starts(0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  // PNG: 8 バイトの決まった並び
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  // JPEG: FF D8 FF
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  // GIF: "GIF8"
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  // WebP: "RIFF" ... "WEBP"(8〜11 バイト目)
  if (starts(0x52, 0x49, 0x46, 0x46)
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  // ZIP: "PK\x03\x04" —— **xlsx / docx / pptx もこれ**
  if (starts(0x50, 0x4b, 0x03, 0x04)) return "application/zip";
  return undefined;
}

/**
 * 名乗った種別と中身が食い違っていないかを見る。
 *
 * **食い違いを見つけても「危険」とは限りません。**
 * `sniffMimeType` が知らない形式（テキスト・CSV・音声など）は
 * `undefined` を返すので、**判定できないものは通します**。
 *
 * **ZIP を土台にした形式に注意。** `.xlsx` を送ると中身は `application/zip` なので、
 * 名乗りが `application/vnd.openxmlformats-...` でも**食い違いになります**
 * ——`allowZipBased` を `true` にすると、この組み合わせを許します。
 *
 * @param bytes ファイルの先頭
 * @param declared 送る側が名乗った Content-Type
 * @param options `allowZipBased` … ZIP を土台にした形式（xlsx / docx / pptx）を許すか
 * @returns 食い違っていれば `false`。**判定できない場合も `true`**
 */
export function matchesDeclaredType(
  bytes: Uint8Array,
  declared: string,
  options: { allowZipBased?: boolean } = {},
): boolean {
  const actual = sniffMimeType(bytes);
  if (actual === undefined) return true; // 知らない形式は通す
  if (actual === declared) return true;
  // **ZIP を土台にした形式**は中身が zip に見える
  if (options.allowZipBased === true && actual === "application/zip"
    && /openxmlformats|opendocument|application\/zip/.test(declared)) {
    return true;
  }
  return false;
}

/**
 * JPEG に **EXIF（撮影情報）が入っているか**を見る。
 *
 * 【なぜ要るか】
 * スマホで撮った写真には、**撮影日時・機種・GPS の位置情報**が入ります。
 * 領収書を撮ってアップロードすると、**どこで撮ったかが残ります**——
 * 社内アプリでも、持ち出されたら分かってしまいます。
 *
 * **画像を変換すれば普通は落ちます**が、**そのまま保存すると残ります**。
 *
 * 【限界】
 * **「EXIF の領域があるか」しか見ません。** 中に GPS が入っているかまでは見ません
 * ——中身を読むには EXIF の解析が要り、依存ゼロでは重すぎます。
 * **あれば「消した方がよい」と判断する**ための目安です。
 *
 * 除去は `@platform/image`（sharp）で変換すればできます。
 * ここは**依存を増やさず気づくため**のものです。
 *
 * @param bytes JPEG の先頭（**4 バイトあれば足ります**）
 * @returns EXIF の領域があれば true。JPEG でなければ false
 */
export function hasJpegExif(bytes: Uint8Array): boolean {
  // JPEG は FF D8 で始まる
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  // **APP1 マーカー（FF E1）が EXIF の入れ物。**
  // 直後に来るとは限らないので、先頭の数マーカーを追う
  let i = 2;
  // **64 KB まで見れば足りる。** EXIF はファイルの先頭に置く決まり
  const limit = Math.min(bytes.length - 1, 65_536);
  while (i < limit) {
    if (bytes[i] !== 0xff) break; // マーカーでなければ画像データに入った
    const marker = bytes[i + 1];
    if (marker === undefined) break;
    if (marker === 0xe1) return true; // APP1 = EXIF
    if (marker === 0xda) break; // SOS = 画像データの開始。ここから先に EXIF は無い
    // セグメントの長さ（2 バイト、ビッグエンディアン）を読んで次へ
    const len = ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
    if (len < 2) break; // 壊れている
    i += 2 + len;
  }
  return false;
}
