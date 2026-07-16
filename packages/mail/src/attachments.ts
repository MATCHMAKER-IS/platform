/**
 * メール添付ファイルの組み立てと検証。
 * base64 からの生成、合計サイズ・件数・種別の検証を提供する。純ロジック。
 * @packageDocumentation
 */
import type { MailAttachment } from "./index";

/** 拡張子 → MIME タイプの簡易対応表。 */
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf", csv: "text/csv", txt: "text/plain",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip", json: "application/json", html: "text/html",
};

/**
 * 拡張子から MIME タイプを推定する。
 *
 * **推定であって検証ではない**(拡張子は偽装できる)。
 *
 * @param filename ファイル名
 * @returns MIME タイプ。**不明なら `application/octet-stream`**
 */
export function guessContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/**
 * base64 から添付を作る。
 *
 * @param filename ファイル名
 * @param base64 base64 文字列
 * @param contentType MIME タイプ(**省略時はファイル名から推定**)
 * @returns 添付
 */
export function attachmentFromBase64(filename: string, base64: string, contentType?: string): MailAttachment {
  return { filename, content: base64, encoding: "base64", contentType: contentType ?? guessContentType(filename) };
}

/**
 * バイト列から添付を作る。
 *
 * @param filename ファイル名
 * @param bytes バイト列
 * @param contentType MIME タイプ
 * @returns 添付
 */
export function attachmentFromBytes(filename: string, bytes: Uint8Array, contentType?: string): MailAttachment {
  return { filename, content: bytes, encoding: "binary", contentType: contentType ?? guessContentType(filename) };
}

/**
 * インライン画像の添付を作る。
 *
 * **HTML から `cid:CID` で参照する**(`<img src="cid:logo">`)。
 * 外部 URL の画像はメーラーでブロックされることが多いので、
 * 確実に見せたいならインラインにする。
 *
 * @param cid 参照する ID
 * @param filename ファイル名
 * @param bytes バイト列
 * @returns 添付(**inline**)
 */
export function inlineImage(cid: string, filename: string, base64: string, contentType?: string): MailAttachment {
  return { filename, content: base64, encoding: "base64", contentType: contentType ?? guessContentType(filename), cid };
}

/**
 * 添付のサイズを返す。
 *
 * **base64 は復号後の実サイズ**を返す(base64 の文字列長は実サイズの約 1.33 倍)。
 *
 * @param attachment 添付
 * @returns バイト数
 */
export function attachmentSize(attachment: MailAttachment): number {
  const { content } = attachment;
  if (typeof content !== "string") return content.byteLength;
  // base64 の実バイト数 = floor(len*3/4) - パディング分
  const len = content.length;
  if (len === 0) return 0;
  const padding = content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

/**
 * 添付合計サイズ(バイト)。
 *
 *
 * @param attachments 添付の配列
 * @returns 合計バイト数(**送信前に上限を確認する**。多くのサービスは 25MB 前後が上限)
 */
export function totalAttachmentSize(attachments: MailAttachment[]): number {
  return attachments.reduce((sum, a) => sum + attachmentSize(a), 0);
}

/** {@link validateAttachments} の制約。 */
export interface AttachmentLimits {
  /** 合計サイズの上限(バイト)。既定 25MB。 */
  maxTotalBytes?: number;
  /** 件数の上限。 */
  maxCount?: number;
  /** 許可する MIME タイプ(未指定なら全許可)。 */
  allowedTypes?: string[];
  /** 拒否する拡張子(例 ["exe","bat","js"])。 */
  blockedExtensions?: string[];
}

/**
 * 添付を検証する。問題があれば errors に理由を積む。
 *
 * @param attachments 添付の配列
 * @param options.maxTotalBytes / maxCount / allowedTypes 制限
 */
export function validateAttachments(attachments: MailAttachment[], limits: AttachmentLimits = {}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const maxTotal = limits.maxTotalBytes ?? 25 * 1024 * 1024;
  const total = totalAttachmentSize(attachments);
  if (total > maxTotal) errors.push(`添付の合計サイズが上限を超えています(${total} > ${maxTotal} バイト)`);
  if (limits.maxCount !== undefined && attachments.length > limits.maxCount) {
    errors.push(`添付の件数が上限を超えています(${attachments.length} > ${limits.maxCount})`);
  }
  const allowed = limits.allowedTypes ? new Set(limits.allowedTypes.map((t) => t.toLowerCase())) : null;
  const blockedExt = new Set((limits.blockedExtensions ?? []).map((e) => e.toLowerCase()));
  for (const a of attachments) {
    const type = (a.contentType ?? guessContentType(a.filename)).toLowerCase();
    if (allowed && !allowed.has(type)) errors.push(`許可されていない種別: ${a.filename}(${type})`);
    const ext = a.filename.split(".").pop()?.toLowerCase() ?? "";
    if (blockedExt.has(ext)) errors.push(`拒否された拡張子: ${a.filename}`);
    if (!a.filename) errors.push("ファイル名が空の添付があります");
  }
  return { ok: errors.length === 0, errors };
}
