/**
 * 掲示板投稿の添付ファイル(純ロジック)。実体保存は `@platform/upload`/`@platform/storage`。
 * @packageDocumentation
 */

/** 添付ファイルのメタ情報(`@platform/upload` の UploadedFile と整合)。 */
export interface Attachment {
  key: string;
  name: string;
  size: number;
  type: string;
}

/** 添付の制約。 */
export interface AttachmentLimits {
  maxCount?: number;
  maxSizeBytes?: number;
  allowedTypes?: string[];
}

export type AttachmentResult = { ok: true } | { ok: false; error: string };

/** 添付の件数・サイズ・種別を検証する。 */
export function validateAttachments(attachments: Attachment[], limits: AttachmentLimits = {}): AttachmentResult {
  const { maxCount, maxSizeBytes, allowedTypes } = limits;
  if (maxCount != null && attachments.length > maxCount) return { ok: false, error: `添付は最大${maxCount}件までです` };
  for (const a of attachments) {
    if (maxSizeBytes != null && a.size > maxSizeBytes) return { ok: false, error: `ファイルサイズが上限(${Math.floor(maxSizeBytes / 1024 / 1024)}MB)を超えています: ${a.name}` };
    if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.some((t) => a.type.startsWith(t))) return { ok: false, error: `許可されていない形式です: ${a.name}（${a.type}）` };
  }
  return { ok: true };
}

/** 画像添付だけを返す。 */
export function imageAttachments(attachments: Attachment[]): Attachment[] {
  return attachments.filter((a) => a.type.startsWith("image/"));
}
