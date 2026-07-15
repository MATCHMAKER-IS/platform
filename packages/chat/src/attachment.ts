/**
 * 添付ファイルのメタ情報と検証(純ロジック)。実体の保存は `@platform/upload`/`@platform/storage`、
 * ここではメッセージに紐づくメタ情報の形と、件数・サイズ・種別の検証だけを担う。
 * @packageDocumentation
 */

/** 添付ファイルのメタ情報(`@platform/upload` の UploadedFile と整合)。 */
export interface Attachment {
  /** storage 上のキー。 */
  key: string;
  /** 元のファイル名。 */
  name: string;
  /** バイト数。 */
  size: number;
  /** MIME タイプ。 */
  type: string;
  /** サムネイル画像の storage キー(画像添付のみ・非同期生成)。 */
  thumbnailKey?: string;
}

/** 添付の制約。 */
export interface AttachmentLimits {
  /** 1 メッセージあたりの最大添付数。 */
  maxCount?: number;
  /** 1 ファイルの最大バイト数。 */
  maxSizeBytes?: number;
  /** 許可する MIME(前方一致、例: ["image/", "application/pdf"])。空なら無制限。 */
  allowedTypes?: string[];
}

/** 検証結果。 */
export type AttachmentResult = { ok: true } | { ok: false; error: string };

/** 添付の件数・サイズ・種別を検証する。 */
export function validateAttachments(attachments: Attachment[], limits: AttachmentLimits = {}): AttachmentResult {
  const { maxCount, maxSizeBytes, allowedTypes } = limits;
  if (maxCount != null && attachments.length > maxCount) {
    return { ok: false, error: `添付は最大${maxCount}件までです` };
  }
  for (const a of attachments) {
    if (maxSizeBytes != null && a.size > maxSizeBytes) {
      return { ok: false, error: `ファイルサイズが上限(${Math.floor(maxSizeBytes / 1024 / 1024)}MB)を超えています: ${a.name}` };
    }
    if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.some((t) => a.type.startsWith(t))) {
      return { ok: false, error: `許可されていない形式です: ${a.name}（${a.type}）` };
    }
  }
  return { ok: true };
}

/** 画像添付だけを返す。 */
export function imageAttachments(attachments: Attachment[]): Attachment[] {
  return attachments.filter((a) => a.type.startsWith("image/"));
}

/** 合計バイト数。 */
export function totalSize(attachments: Attachment[]): number {
  return attachments.reduce((sum, a) => sum + a.size, 0);
}
