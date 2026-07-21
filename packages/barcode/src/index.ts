/**
 * `@platform/barcode` — QR コード・バーコードの**発行**(生成)。
 *
 * サーバ(帳票 PDF・ラベル印刷)でもブラウザ(画面表示)でも**同じ関数で SVG が出せる**。
 * 実体は `qrcode`(QR)と `bwip-js`(1 次元バーコード)。**規格が複雑で誤り訂正も要るため自作しない。**
 *
 * **読み取りは `@platform/mobile`**(BarcodeDetector・JAN/EAN のチェックディジット検証)。
 * 「読む」と「出す」で関心が違うので分けてある。
 *
 * @example
 * ```ts
 * const svg = await qrSvg("https://example.co.jp/asset/A-0042");   // 備品ラベル
 * const png = await qrDataUrl(otpauthUri, { level: "M" });          // TOTP 登録用
 * const bar = await barcodeSvg("4901234567894", { format: "ean13" }); // JAN
 * ```
 * @packageDocumentation
 */
/// <reference path="./bwip-js.d.ts" />
import QRCode from "qrcode";
import bwipjs from "bwip-js";
import { ok, err, AppError, ErrorCode, type Result } from "@platform/core";

/**
 * QR の誤り訂正レベル。
 *
 * @remarks
 * **高いほど汚れ・破損に強いが、同じ情報量なら絵柄が大きくなる。**
 * - `L` 約 7% 復元(画面表示)
 * - `M` 約 15%(既定・普通の印刷)
 * - `Q` 約 25%(屋外・現場の備品ラベル)
 * - `H` 約 30%(中央にロゴを重ねる場合)
 */
export type QrLevel = "L" | "M" | "Q" | "H";

/** {@link qrSvg} / {@link qrDataUrl} の指定。 */
export interface QrOptions {
  /** 誤り訂正レベル(既定 `M`)。 */
  level?: QrLevel;
  /** 余白のモジュール数(既定 4)。**0 にすると読み取り率が落ちる**ので推奨しない。 */
  margin?: number;
  /** 1 辺の px(既定 256)。`qrDataUrl` のみ有効。 */
  width?: number;
  /** 前景色(既定 `#000000`)。 */
  dark?: string;
  /** 背景色(既定 `#ffffff`)。**透過にすると印刷で読めないことがある。** */
  light?: string;
}

/**
 * QR コードを SVG 文字列で返す。
 *
 * @remarks
 * **帳票 PDF・ラベル印刷向け。** ベクタなので拡大しても粗くならない。
 * サーバでもブラウザでも動く(DOM に依存しない)。
 *
 * @param text 埋め込む文字列(URL・ID・otpauth URI など)
 * @param options 指定
 * @returns SVG の文字列。**空文字なら失敗**(QR は空を表せない)
 */
export async function qrSvg(text: string, options: QrOptions = {}): Promise<Result<string>> {
  if (text === "") return err(new AppError(ErrorCode.VALIDATION, "QR にする文字列が空です"));
  try {
    const svg = await QRCode.toString(text, {
      type: "svg",
      errorCorrectionLevel: options.level ?? "M",
      margin: options.margin ?? 4,
      color: { dark: options.dark ?? "#000000", light: options.light ?? "#ffffff" },
    });
    return ok(svg);
  } catch (e) {
    return err(new AppError(ErrorCode.EXTERNAL, e instanceof Error ? e.message : "QR の生成に失敗しました"));
  }
}

/**
 * QR コードを PNG の data URL で返す。
 *
 * @remarks
 * **`<img src>` にそのまま渡せる。** 画面表示向け。
 * 印刷に使うなら {@link qrSvg} の方が綺麗。
 *
 * @param text 埋め込む文字列
 * @param options 指定
 * @returns `data:image/png;base64,...`
 */
export async function qrDataUrl(text: string, options: QrOptions = {}): Promise<Result<string>> {
  if (text === "") return err(new AppError(ErrorCode.VALIDATION, "QR にする文字列が空です"));
  try {
    const url = await QRCode.toDataURL(text, {
      errorCorrectionLevel: options.level ?? "M",
      margin: options.margin ?? 4,
      width: options.width ?? 256,
      color: { dark: options.dark ?? "#000000", light: options.light ?? "#ffffff" },
    });
    return ok(url);
  } catch (e) {
    return err(new AppError(ErrorCode.EXTERNAL, e instanceof Error ? e.message : "QR の生成に失敗しました"));
  }
}

/**
 * 1 次元バーコードの種類。
 *
 * @remarks
 * 業務で使うものだけを挙げる。
 * - `ean13` JAN(日本の商品コード・13 桁)
 * - `ean8` 短い JAN(8 桁)
 * - `code128` 英数字が入る(**社内の管理番号はこれ**)
 * - `code39` 古い機器でも読める(英数字・記号の一部)
 * - `itf14` 段ボール外装(集合包装用)
 */
export type BarcodeFormat = "ean13" | "ean8" | "code128" | "code39" | "itf14";

/** {@link barcodeSvg} の指定。 */
export interface BarcodeOptions {
  format: BarcodeFormat;
  /** バーの高さ(mm 相当・既定 10)。 */
  height?: number;
  /** 人が読む文字を下に出す(既定 true)。**目視確認できないと現場が困る。** */
  includeText?: boolean;
  /** 拡大率(既定 2)。小さいと読み取り機が拾えない。 */
  scale?: number;
}

/**
 * 1 次元バーコードを SVG 文字列で返す。
 *
 * @remarks
 * **サーバでもブラウザでも動く**(`bwip-js` は DOM に依存しない SVG 出力を持つ)。
 * 桁数やチェックディジットが規格に合わないと失敗する——
 * **`ean13` は 12 桁 + チェックディジット 1 桁、または 13 桁**。
 * 事前検証は `@platform/mobile` の `isValidEan13()` を使う。
 *
 * @param value バーコードにする値
 * @param options 種類と見た目
 * @returns SVG の文字列
 */
export async function barcodeSvg(value: string, options: BarcodeOptions): Promise<Result<string>> {
  if (value === "") return err(new AppError(ErrorCode.VALIDATION, "バーコードにする値が空です"));
  try {
    const svg = bwipjs.toSVG({
      bcid: options.format,
      text: value,
      height: options.height ?? 10,
      includetext: options.includeText ?? true,
      textxalign: "center",
      scale: options.scale ?? 2,
    });
    return ok(svg);
  } catch (e) {
    // bwip-js は規格違反を例外で知らせる(桁数・使えない文字など)
    return err(new AppError(ErrorCode.EXTERNAL, e instanceof Error ? e.message : "バーコードの生成に失敗しました"));
  }
}

/** {@link buildAssetUrl} の指定。 */
export interface AssetUrlOptions {
  /** 社内のベース URL(例 `https://portal.example.co.jp`)。 */
  baseUrl: string;
  /** 資産の種類(例 `asset` / `employee` / `invoice`)。 */
  kind: string;
  /** 資産の ID。 */
  id: string;
}

/**
 * QR に埋め込む社内 URL を組み立てる。
 *
 * @remarks
 * **QR に ID だけを入れてはいけない。** 「A-0042」だけでは、読み取った人が
 * どこへ行けばよいか分からない。**URL を入れれば、標準のカメラアプリで開ける**
 * (専用アプリを配らなくて済む)。
 *
 * @param options ベース URL と資産の情報
 * @returns `https://portal.example.co.jp/asset/A-0042` の形
 */
export function buildAssetUrl(options: AssetUrlOptions): string {
  const base = options.baseUrl.replace(/\/+$/, "");
  return `${base}/${encodeURIComponent(options.kind)}/${encodeURIComponent(options.id)}`;
}
