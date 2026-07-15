/**
 * S3 互換 Storage Adapter。AWS S3 と ConoHa 等の S3 互換ストレージの両方で使える。
 * AWS SDK をこのファイル内だけで import し、ローカル利用時に SDK 依存を持ち込まない。
 * @packageDocumentation
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageAdapter, PutOptions } from "../index.js";

/** S3 互換ストレージの接続設定。 */
export interface S3StorageConfig {
  bucket: string;
  region: string;
  /** S3 互換(ConoHa 等)の場合のエンドポイント URL。AWS なら省略。 */
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** 互換ストレージで必要な場合が多い(パス形式アクセス)。 */
  forcePathStyle?: boolean;
}

async function toBytes(body: unknown): Promise<Uint8Array> {
  const stream = body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (stream.transformToByteArray) return stream.transformToByteArray();
  throw new Error("S3 レスポンスの本文を読み取れませんでした");
}

/**
 * S3 互換 Adapter を作る。
 * @param config 接続設定
 * @returns {@link StorageAdapter} 実装
 */
export function createS3Storage(config: S3StorageConfig): StorageAdapter {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const Bucket = config.bucket;
  return {
    async put(key: string, body: Uint8Array, options?: PutOptions) {
      await client.send(
        new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: options?.contentType }),
      );
    },
    async get(key: string) {
      const res = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      return toBytes(res.Body);
    },
    async delete(key: string) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
    async exists(key: string) {
      try {
        await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return true;
      } catch {
        return false;
      }
    },
    async list(prefix?: string) {
      const res = await client.send(new ListObjectsV2Command({ Bucket, Prefix: prefix }));
      return (res.Contents ?? []).map((o) => o.Key ?? "").filter(Boolean);
    },
    async presignPut(key, options) {
      return getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentType: options?.contentType }),
        { expiresIn: options?.expiresInSec ?? 900 },
      );
    },
    async presignGet(key, options) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        { expiresIn: options?.expiresInSec ?? 900 },
      );
    },
  };
}
