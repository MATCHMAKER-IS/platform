/**
 * `@platform/storage` — ファイル操作の共通部品(Adapter パターン)。
 *
 * 保存先(ローカルディスク / S3 互換オブジェクトストレージ)を意識せず使える。
 * ConoHa のオブジェクトストレージ・AWS S3 のどちらでも同じ API で扱え、
 * ローカル開発ではディスクに保存できる。アプリは保存先を知らないまま呼ぶ。
 *
 * @packageDocumentation
 */

import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";

/** put 時のオプション。 */
export interface PutOptions {
  /** MIME タイプ(例: "application/pdf")。 */
  contentType?: string;
}

/** 署名付き URL のオプション。 */
export interface PresignOptions {
  /** 有効期限(秒、既定 900=15分)。 */
  expiresInSec?: number;
  /** アップロード時に想定する MIME タイプ。 */
  contentType?: string;
}

/**
 * 保存先の抽象(Adapter)。新しい保存先を足すときはこれを実装する。
 * 各メソッドは失敗時に例外を投げてよい(上位の {@link Storage} が正規化する)。
 * presign 系は対応する保存先(S3 等)でのみ実装する(任意)。
 */
export interface StorageAdapter {
  put(key: string, body: Uint8Array, options?: PutOptions): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix?: string): Promise<string[]>;
  /** アップロード用の署名付き URL(クライアント直アップロード)。 */
  presignPut?(key: string, options?: PresignOptions): Promise<string>;
  /** ダウンロード用の署名付き URL(一時公開)。 */
  presignGet?(key: string, options?: PresignOptions): Promise<string>;
}

/** アプリが使うファイル操作口。失敗は Result で返る。 */
export interface Storage {
  /** ファイルを保存する。 */
  put(key: string, body: Uint8Array, options?: PutOptions): Promise<Result<void>>;
  /** ファイルを取得する。 */
  get(key: string): Promise<Result<Uint8Array>>;
  /** ファイルを削除する。 */
  delete(key: string): Promise<Result<void>>;
  /** 存在確認。 */
  exists(key: string): Promise<Result<boolean>>;
  /** プレフィックスでキー一覧を取得する。 */
  list(prefix?: string): Promise<Result<string[]>>;
  /** アップロード用の署名付き URL を発行する(未対応の保存先では err)。 */
  presignUpload(key: string, options?: PresignOptions): Promise<Result<string>>;
  /** ダウンロード用の署名付き URL を発行する(未対応の保存先では err)。 */
  presignDownload(key: string, options?: PresignOptions): Promise<Result<string>>;
}

function wrapError(cause: unknown, msg: string): AppError {
  return new AppError(ErrorCode.EXTERNAL, msg, { cause });
}

/**
 * Adapter を注入して Storage を作る。
 *
 * @param adapter 保存先の実装({@link createLocalStorage} / {@link createS3Storage})
 * @returns アプリ向けの {@link Storage}
 *
 * @example
 * ```ts
 * const storage = createStorage(createLocalStorage("./uploads"));
 * await storage.put("invoices/2026-01.pdf", bytes, { contentType: "application/pdf" });
 * ```
 */
export function createStorage(adapter: StorageAdapter): Storage {
  return {
    put: (key, body, options) =>
      tryCatch(() => adapter.put(key, body, options)).then((r) =>
        r.ok ? r : { ok: false, error: wrapError(r.error.cause ?? r.error, "ファイル保存に失敗しました") },
      ),
    get: (key) =>
      tryCatch(() => adapter.get(key)).then((r) =>
        r.ok ? r : { ok: false, error: wrapError(r.error.cause ?? r.error, "ファイル取得に失敗しました") },
      ),
    delete: (key) =>
      tryCatch(() => adapter.delete(key)).then((r) =>
        r.ok ? r : { ok: false, error: wrapError(r.error.cause ?? r.error, "ファイル削除に失敗しました") },
      ),
    exists: (key) =>
      tryCatch(() => adapter.exists(key)).then((r) =>
        r.ok ? r : { ok: false, error: wrapError(r.error.cause ?? r.error, "存在確認に失敗しました") },
      ),
    list: (prefix) =>
      tryCatch(() => adapter.list(prefix)).then((r) =>
        r.ok ? r : { ok: false, error: wrapError(r.error.cause ?? r.error, "一覧取得に失敗しました") },
      ),
    presignUpload: (key, options) => {
      if (!adapter.presignPut) {
        return Promise.resolve({ ok: false, error: new AppError(ErrorCode.INTERNAL, "この保存先は署名付きアップロードURLに対応していません") });
      }
      return tryCatch(() => adapter.presignPut!(key, options)).then((r) =>
        r.ok ? r : { ok: false, error: wrapError(r.error.cause ?? r.error, "署名付きURLの発行に失敗しました") },
      );
    },
    presignDownload: (key, options) => {
      if (!adapter.presignGet) {
        return Promise.resolve({ ok: false, error: new AppError(ErrorCode.INTERNAL, "この保存先は署名付きダウンロードURLに対応していません") });
      }
      return tryCatch(() => adapter.presignGet!(key, options)).then((r) =>
        r.ok ? r : { ok: false, error: wrapError(r.error.cause ?? r.error, "署名付きURLの発行に失敗しました") },
      );
    },
  };
}

export { createLocalStorage } from "./adapters/local";
export { createS3Storage, type S3StorageConfig } from "./adapters/s3";
export { withStorageRetry, createFallbackStorage, type StorageRetryOptions, type FallbackStorageOptions } from "./resilient";
