/**
 * サービスアカウント（APIキー）。外部システムやスクリプトが Bearer トークンで社内APIを呼ぶための仕組み。
 * 鍵の生成・ハッシュ化・検証・スコープ判定は @platform/apikey を利用する。平文キーは発行時のみ返す。
 * @packageDocumentation
 */
import { generateApiKey, hashApiKey, hasScope, type ApiKeyRecord } from "@platform/apikey";

/** サービスアカウント（保存用。hash のみ保持し平文は保存しない）。 */
export interface ServiceAccount {
  id: string;
  name: string;
  hash: string;
  displayPrefix: string;
  scopes: string[];
  active: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

/** 一覧・表示用（秘密情報を含まない）。 */
export interface ServiceAccountView {
  id: string;
  name: string;
  displayPrefix: string;
  scopes: string[];
  active: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

/** 表示用に変換（hash を落とす）。 */
export function toView(a: ServiceAccount): ServiceAccountView {
  return { id: a.id, name: a.name, displayPrefix: a.displayPrefix, scopes: a.scopes, active: a.active, createdAt: a.createdAt, ...(a.lastUsedAt ? { lastUsedAt: a.lastUsedAt } : {}) };
}

/** 認証結果。 */
export interface ApiAuthResult {
  ok: boolean;
  account?: ServiceAccountView;
  reason?: "missing" | "invalid" | "revoked" | "forbidden";
}

/**
 * 提示された Bearer キーを検証し、必要スコープを満たすか判定する。
 * ハッシュ一致・有効・スコープを確認。@platform/apikey の hashApiKey/hasScope を使用。
 */
export function authenticateKey(accounts: ServiceAccount[], presentedKey: string | undefined, requiredScope?: string): ApiAuthResult {
  if (!presentedKey) return { ok: false, reason: "missing" };
  const hash = hashApiKey(presentedKey);
  const account = accounts.find((a) => a.hash === hash);
  if (!account) return { ok: false, reason: "invalid" };
  if (!account.active) return { ok: false, reason: "revoked" };
  if (requiredScope && !hasScope(account.scopes, requiredScope)) return { ok: false, reason: "forbidden" };
  return { ok: true, account: toView(account) };
}

/** Authorization ヘッダから Bearer トークンを取り出す。 */
export function bearerToken(authorization: string | null): string | undefined {
  if (!authorization) return undefined;
  const m = authorization.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : undefined;
}

/** ApiKeyRecord への変換（@platform/apikey の汎用検証と併用する場合）。 */
export function toApiKeyRecord(a: ServiceAccount): ApiKeyRecord {
  return { id: a.id, hash: a.hash, scopes: a.scopes, revoked: !a.active };
}

/** サービスアカウントストア。 */
export interface ServiceAccountStore {
  list(): Promise<ServiceAccountView[]>;
  /** 作成。返り値の plaintext は発行時のみ（保存されない）。 */
  create(name: string, scopes: string[]): Promise<{ account: ServiceAccountView; plaintext: string }>;
  setActive(id: string, active: boolean): Promise<void>;
  /** 認証用に全件（hash 込み）を取得する内部用。 */
  all(): Promise<ServiceAccount[]>;
}

let memSeq = 0;

/** インメモリ実装。 */
export function createMemoryServiceAccountStore(): ServiceAccountStore {
  const items: ServiceAccount[] = [];
  return {
    async list() {
      return items.map(toView);
    },
    async create(name, scopes) {
      const key = generateApiKey({ prefix: "sk_live_" });
      const account: ServiceAccount = { id: `sa${memSeq++}`, name, hash: key.hash, displayPrefix: key.displayPrefix, scopes, active: true, createdAt: new Date().toISOString() };
      items.push(account);
      return { account: toView(account), plaintext: key.plaintext };
    },
    async setActive(id, active) {
      const a = items.find((x) => x.id === id);
      if (a) a.active = active;
    },
    async all() {
      return items.map((a) => ({ ...a, scopes: [...a.scopes] }));
    },
  };
}

// ── Prisma 実装 ──

/** ServiceAccountRow の必要部分（scopes は CSV）。 */
export interface ServiceAccountRow {
  id: string;
  name: string;
  hash: string;
  displayPrefix: string;
  scopes: string;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface ServiceAccountStoreDb {
  serviceAccountRow: {
    findMany(args: { orderBy: { createdAt: "desc" } }): Promise<ServiceAccountRow[]>;
    create(args: { data: { name: string; hash: string; displayPrefix: string; scopes: string; active: boolean; createdAt: string } }): Promise<ServiceAccountRow>;
    update(args: { where: { id: string }; data: { active: boolean } }): Promise<ServiceAccountRow>;
  };
}

const rowToAccount = (row: ServiceAccountRow): ServiceAccount => ({ id: row.id, name: row.name, hash: row.hash, displayPrefix: row.displayPrefix, scopes: row.scopes ? row.scopes.split(",") : [], active: row.active, createdAt: row.createdAt, ...(row.lastUsedAt ? { lastUsedAt: row.lastUsedAt } : {}) });

/** Prisma 実装。 */
export function createPrismaServiceAccountStore(db: ServiceAccountStoreDb): ServiceAccountStore {
  return {
    async list() {
      return (await db.serviceAccountRow.findMany({ orderBy: { createdAt: "desc" } })).map((r) => toView(rowToAccount(r)));
    },
    async create(name, scopes) {
      const key = generateApiKey({ prefix: "sk_live_" });
      const row = await db.serviceAccountRow.create({ data: { name, hash: key.hash, displayPrefix: key.displayPrefix, scopes: scopes.join(","), active: true, createdAt: new Date().toISOString() } });
      return { account: toView(rowToAccount(row)), plaintext: key.plaintext };
    },
    async setActive(id, active) {
      await db.serviceAccountRow.update({ where: { id }, data: { active } });
    },
    async all() {
      return (await db.serviceAccountRow.findMany({ orderBy: { createdAt: "desc" } })).map(rowToAccount);
    },
  };
}
