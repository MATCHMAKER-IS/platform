/**
 * 画像添付のサムネイル生成。@platform/image で縮小し、@platform/storage に保存する。
 * 画像でない添付はそのまま返す。処理系(sharp)は注入可能でテストしやすい。
 * @packageDocumentation
 */
import { type Attachment } from "@platform/chat";
import { fitDimensions, type ImageProcessor } from "@platform/image";
import { type Storage } from "@platform/storage";

/** サムネイル生成の構成。 */
export interface ThumbnailOptions {
  processor: ImageProcessor;
  storage: Storage;
  /** サムネイルの最大辺(既定 240px)。 */
  maxSize?: number;
  /** キーの接頭辞(既定 "thumbnails")。 */
  keyPrefix?: string;
  /** ID 生成。 */
  newId?: () => string;
}

/** サムネイルサービス。 */
export interface ThumbnailService {
  /** 添付が画像なら縮小版を作って保存し、thumbnailKey を付与して返す。画像でなければそのまま。 */
  ensureThumbnail(attachment: Attachment): Promise<Attachment>;
  /** 複数添付にまとめて適用。 */
  ensureAll(attachments: Attachment[]): Promise<Attachment[]>;
}

/** サービスを生成する。 */
export function createThumbnailService(opts: ThumbnailOptions): ThumbnailService {
  const maxSize = opts.maxSize ?? 240;
  const keyPrefix = opts.keyPrefix ?? "thumbnails";
  const newId = opts.newId ?? (() => `${Date.now()}_${Math.random().toString(36).slice(2)}`);

  const ensureThumbnail = async (attachment: Attachment): Promise<Attachment> => {
    if (!attachment.type.startsWith("image/")) return attachment;
    // 元画像を取得
    const got = await opts.storage.get(attachment.key);
    if (!got.ok) return attachment;
    // メタから縮小後サイズを決める(取得できなくても resize は withoutEnlargement で安全)
    const meta = await opts.processor.metadata(got.value);
    const width = meta.ok ? meta.value.width : undefined;
    const height = meta.ok ? meta.value.height : undefined;
    const target = width && height ? fitDimensions(width, height, { maxWidth: maxSize, maxHeight: maxSize, fit: "contain" }) : { width: maxSize, height: maxSize };
    const out = await opts.processor.process(got.value, [{ op: "resize", width: target.width, height: target.height, fit: "contain", withoutEnlargement: true }]);
    if (!out.ok) return attachment;
    const thumbKey = `${keyPrefix}/${newId()}.jpg`;
    const put = await opts.storage.put(thumbKey, new Uint8Array(out.value), { contentType: "image/jpeg" });
    if (!put.ok) return attachment;
    return { ...attachment, thumbnailKey: thumbKey };
  };

  return {
    ensureThumbnail,
    async ensureAll(attachments) {
      return Promise.all(attachments.map(ensureThumbnail));
    },
  };
}
