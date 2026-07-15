/**
 * ファイル管理。アップロード済みファイルのメタデータを登録・一覧・削除する。
 * 実体は @platform/storage、メタデータはレジストリ(memory/prisma)で管理する。
 * @packageDocumentation
 */
import { type Storage } from "@platform/storage";

/** ファイルのメタデータ。 */
export interface FileMeta {
  key: string;
  name: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
}

/** メタデータのレジストリ(非同期)。 */
export interface FileRegistry {
  /** 登録(同一キーは上書き)。 */
  record(meta: FileMeta): Promise<void>;
  /** 一覧(新しい順)。prefix でキー前方一致絞り込み。 */
  list(options?: { prefix?: string; limit?: number }): Promise<FileMeta[]>;
  /** 1 件取得。 */
  get(key: string): Promise<FileMeta | undefined>;
  /** 登録解除。 */
  remove(key: string): Promise<void>;
}

/** ファイル管理サービス。 */
export interface FileManager {
  registry: FileRegistry;
  /** アップロード済みファイルを登録する。 */
  register(input: { key: string; name: string; size: number; type: string; uploadedBy: string }): Promise<FileMeta>;
  /** 一覧。 */
  list(options?: { prefix?: string; limit?: number }): Promise<FileMeta[]>;
  /** 実体と登録の両方を削除する。 */
  remove(key: string): Promise<{ ok: boolean; error?: string }>;
}

function selectFiles(all: FileMeta[], options: { prefix?: string; limit?: number } = {}): FileMeta[] {
  let rows = all.slice();
  if (options.prefix) rows = rows.filter((f) => f.key.startsWith(options.prefix!));
  rows.sort((a, b) => (a.uploadedAt > b.uploadedAt ? -1 : a.uploadedAt < b.uploadedAt ? 1 : 0));
  if (options.limit !== undefined) rows = rows.slice(0, options.limit);
  return rows;
}

/** インメモリ実装。 */
export function createMemoryFileRegistry(): FileRegistry {
  const byKey = new Map<string, FileMeta>();
  return {
    async record(meta) {
      byKey.set(meta.key, meta);
    },
    async list(opts) {
      return selectFiles([...byKey.values()], opts);
    },
    async get(key) {
      return byKey.get(key);
    },
    async remove(key) {
      byKey.delete(key);
    },
  };
}

/** サービスを作る。 */
export function createFileManager(deps: { storage: Storage; registry: FileRegistry }): FileManager {
  const { storage, registry } = deps;
  return {
    registry,
    async register(input) {
      const meta: FileMeta = { ...input, uploadedAt: new Date().toISOString() };
      await registry.record(meta);
      return meta;
    },
    async list(options) {
      return registry.list(options);
    },
    async remove(key) {
      const res = await storage.delete(key);
      if (!res.ok) return { ok: false, error: res.error.message };
      await registry.remove(key);
      return { ok: true };
    },
  };
}

// ── Prisma 実装 ──

/** FileRow の必要部分。 */
export interface FileRow {
  key: string;
  name: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedAt: Date;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface FileRegistryDb {
  fileRow: {
    upsert(args: { where: { key: string }; create: { key: string; name: string; size: number; type: string; uploadedBy: string; uploadedAt: Date }; update: { name: string; size: number; type: string; uploadedBy: string; uploadedAt: Date } }): Promise<unknown>;
    findMany(args: { where: { key?: { startsWith: string } }; orderBy: { uploadedAt: "desc" }; take?: number }): Promise<FileRow[]>;
    findUnique(args: { where: { key: string } }): Promise<FileRow | null>;
    delete(args: { where: { key: string } }): Promise<unknown>;
  };
}

function rowToFile(row: FileRow): FileMeta {
  return { key: row.key, name: row.name, size: row.size, type: row.type, uploadedBy: row.uploadedBy, uploadedAt: row.uploadedAt.toISOString() };
}

/** Prisma 実装。 */
export function createPrismaFileRegistry(db: FileRegistryDb): FileRegistry {
  return {
    async record(meta) {
      const data = { name: meta.name, size: meta.size, type: meta.type, uploadedBy: meta.uploadedBy, uploadedAt: new Date(meta.uploadedAt) };
      await db.fileRow.upsert({ where: { key: meta.key }, create: { key: meta.key, ...data }, update: data });
    },
    async list(opts = {}) {
      const where = opts.prefix ? { key: { startsWith: opts.prefix } } : {};
      const rows = await db.fileRow.findMany({ where, orderBy: { uploadedAt: "desc" }, ...(opts.limit !== undefined ? { take: opts.limit } : {}) });
      return rows.map(rowToFile);
    },
    async get(key) {
      const row = await db.fileRow.findUnique({ where: { key } });
      return row ? rowToFile(row) : undefined;
    },
    async remove(key) {
      await db.fileRow.delete({ where: { key } });
    },
  };
}
