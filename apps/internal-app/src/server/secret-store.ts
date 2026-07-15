/**
 * 秘密情報管理。外部API資格情報・Webhook secret 等を暗号化して保存し、TTL キャッシュ付きで取得する。
 * 取得抽象は @platform/secrets（チェーン: DB→環境変数）、保存時の暗号化は @platform/crypto（AES）を利用する。
 * @packageDocumentation
 */
import { createSecretStore, createEnvProvider, createChainProvider, type SecretProvider, type SecretStore } from "@platform/secrets";
import { encrypt, decrypt, deriveKey } from "@platform/crypto";

/** マスター鍵から暗号鍵を導出（salt は固定・鍵は env で管理）。 */
function keyFrom(masterSecret: string): Buffer {
  return deriveKey(masterSecret, "platform-secret-store");
}

/** 平文を暗号化して保存用文字列にする。 */
export function sealSecret(masterSecret: string, plaintext: string): string {
  return encrypt(plaintext, keyFrom(masterSecret));
}

/** 保存文字列を復号する。 */
export function openSecret(masterSecret: string, ciphertext: string): string {
  return decrypt(ciphertext, keyFrom(masterSecret));
}

/** 保存された秘密（暗号文）。 */
export interface SecretRecord {
  name: string;
  ciphertext: string;
  updatedAt: string;
}

/** 秘密ストア（暗号文の永続化）。 */
export interface SecretRecordStore {
  list(): Promise<{ name: string; updatedAt: string }[]>;
  getCiphertext(name: string): Promise<string | null>;
  set(name: string, ciphertext: string): Promise<void>;
  remove(name: string): Promise<void>;
}

/** インメモリ実装。 */
export function createMemorySecretRecordStore(): SecretRecordStore {
  const items = new Map<string, SecretRecord>();
  return {
    async list() {
      return [...items.values()].map((r) => ({ name: r.name, updatedAt: r.updatedAt })).sort((a, b) => (a.name < b.name ? -1 : 1));
    },
    async getCiphertext(name) {
      return items.get(name)?.ciphertext ?? null;
    },
    async set(name, ciphertext) {
      items.set(name, { name, ciphertext, updatedAt: new Date().toISOString() });
    },
    async remove(name) {
      items.delete(name);
    },
  };
}

/** 暗号化 DB ストアを SecretProvider（復号して返す）にする。 */
export function createDbSecretProvider(store: SecretRecordStore, masterSecret: string): SecretProvider {
  return {
    async get(name) {
      const ct = await store.getCiphertext(name);
      if (ct === null) return null;
      try {
        return openSecret(masterSecret, ct);
      } catch {
        return null;
      }
    },
  };
}

/** アプリの秘密ストアを組み立てる（DB→環境変数のチェーン・TTL キャッシュ）。 */
export function createAppSecretStore(recordStore: SecretRecordStore, masterSecret: string, env: Record<string, string | undefined>, ttlMs = 5 * 60 * 1000): SecretStore {
  const provider = createChainProvider([createDbSecretProvider(recordStore, masterSecret), createEnvProvider(env)]);
  return createSecretStore(provider, { ttlMs });
}

/**
 * 秘密の保存（暗号化）。ローテーション時も同じ関数で上書きし、キャッシュを無効化する。
 * @returns 保存後の名前
 */
export async function putSecret(recordStore: SecretRecordStore, secretStore: SecretStore, masterSecret: string, name: string, plaintext: string): Promise<string> {
  await recordStore.set(name, sealSecret(masterSecret, plaintext));
  secretStore.invalidate(name); // ローテーション直後に再取得させる
  return name;
}

// ── Prisma 実装 ──

/** SecretRow の必要部分。 */
export interface SecretRow {
  name: string;
  ciphertext: string;
  updatedAt: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface SecretRecordStoreDb {
  secretRow: {
    findMany(args: { orderBy: { name: "asc" } }): Promise<SecretRow[]>;
    findUnique(args: { where: { name: string } }): Promise<SecretRow | null>;
    upsert(args: { where: { name: string }; create: SecretRow; update: { ciphertext: string; updatedAt: string } }): Promise<SecretRow>;
    delete(args: { where: { name: string } }): Promise<SecretRow>;
  };
}

/** Prisma 実装。 */
export function createPrismaSecretRecordStore(db: SecretRecordStoreDb): SecretRecordStore {
  return {
    async list() {
      return (await db.secretRow.findMany({ orderBy: { name: "asc" } })).map((r) => ({ name: r.name, updatedAt: r.updatedAt }));
    },
    async getCiphertext(name) {
      const row = await db.secretRow.findUnique({ where: { name } });
      return row?.ciphertext ?? null;
    },
    async set(name, ciphertext) {
      const updatedAt = new Date().toISOString();
      await db.secretRow.upsert({ where: { name }, create: { name, ciphertext, updatedAt }, update: { ciphertext, updatedAt } });
    },
    async remove(name) {
      await db.secretRow.delete({ where: { name } });
    },
  };
}
