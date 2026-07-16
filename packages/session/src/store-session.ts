/**
 * ストア型セッション。ランダムなセッションID をクッキーに置き、実データはストア
 * (Redis 等)に保存する。サーバ側で失効(destroy)でき、大きめのデータも扱える。
 * ストアは {@link SessionStore}(`@platform/cache` の Store も構造的に適合)を渡す。
 * @packageDocumentation
 */
import { randomToken } from "@platform/crypto";
import { getCookie, serializeCookie, clearCookie, type CookieOptions } from "./cookie.js";

/** セッションデータの保存先(get/set/delete)。 */
export interface SessionStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

/** {@link createServerSession} の設定。 */
export interface ServerSessionConfig {
  store: SessionStore;
  /** クッキー名(既定 "sid")。 */
  cookieName?: string;
  /** 有効期間(秒、既定 7 日)。 */
  ttlSec?: number;
  /** ストアのキー接頭辞(既定 "sess:")。 */
  keyPrefix?: string;
  cookie?: CookieOptions;
}

/** ストア型セッションの操作。 */
export interface ServerSession<T> {
  /** 新規セッションを作成し、`{ id, setCookie }` を返す。userId を渡すと全端末ログアウトの対象になる。 */
  create(data: T, opts?: { userId?: string }): Promise<{ id: string; setCookie: string }>;
  /** Cookie ヘッダからセッションデータを読む。 */
  read(cookieHeader: string | null | undefined): Promise<T | null>;
  /** 既存セッションのデータを更新する。 */
  update(id: string, data: T): Promise<void>;
  /** セッションを破棄し、失効用 Set-Cookie を返す。 */
  destroy(cookieHeader: string | null | undefined): Promise<string>;
  /**
   * セッション ID を再生成する(セッション固定攻撃対策)。
   * ログイン成功・権限昇格の直後に呼ぶ。旧 ID は失効し、新 ID の Set-Cookie を返す。
   * data 未指定なら現在のデータを引き継ぐ。
   */
  regenerate(cookieHeader: string | null | undefined, data?: T): Promise<{ id: string; setCookie: string } | null>;
  /** 指定ユーザーの全セッションを失効させる(全端末ログアウト)。失効件数を返す。 */
  destroyAllForUser(userId: string): Promise<number>;
  /** 指定ユーザーの有効なセッション ID 一覧(端末管理 UI 用)。 */
  listUserSessions(userId: string): Promise<string[]>;
}

/**
 * ストア型セッションを作る。
 * @example
 * ```ts
 * const session = createServerSession<{ userId: string; roles: string[] }>({ store });
 * const { setCookie } = await session.create({ userId, roles });
 * const data = await session.read(req.headers.get("cookie"));
 * ```
 *
 * @param config.store 保存先(Redis など)
 * @param config.secret セッション ID の署名鍵
 * @param config.maxAgeSec 有効期間(秒)
 * @returns サーバ側セッション。**Cookie には ID しか入らない**ので、中身が大きくても・秘密でも扱える
 */
export function createServerSession<T>(config: ServerSessionConfig): ServerSession<T> {
  const { store, cookieName = "sid", ttlSec = 60 * 60 * 24 * 7, keyPrefix = "sess:", cookie } = config;
  const k = (id: string) => `${keyPrefix}${id}`;
  const userKey = (userId: string) => `${keyPrefix}user:${userId}`;

  /** セッションエンベロープ(ユーザー索引のため userId も保持)。 */
  interface Envelope { data: T; userId?: string }

  async function readUserIndex(userId: string): Promise<string[]> {
    const raw = await store.get(userKey(userId));
    if (!raw) return [];
    try { return JSON.parse(raw) as string[]; } catch { return []; }
  }
  async function addToUserIndex(userId: string, id: string): Promise<void> {
    const ids = await readUserIndex(userId);
    if (!ids.includes(id)) ids.push(id);
    await store.set(userKey(userId), JSON.stringify(ids), ttlSec);
  }
  async function removeFromUserIndex(userId: string, id: string): Promise<void> {
    const ids = (await readUserIndex(userId)).filter((x) => x !== id);
    if (ids.length > 0) await store.set(userKey(userId), JSON.stringify(ids), ttlSec);
    else await store.delete(userKey(userId));
  }
  async function envelopeOf(id: string): Promise<Envelope | null> {
    const raw = await store.get(k(id));
    if (!raw) return null;
    try { return JSON.parse(raw) as Envelope; } catch { return null; }
  }

  async function createSession(data: T, userId?: string): Promise<{ id: string; setCookie: string }> {
    const id = randomToken(24);
    const env: Envelope = { data, ...(userId ? { userId } : {}) };
    await store.set(k(id), JSON.stringify(env), ttlSec);
    if (userId) await addToUserIndex(userId, id);
    return { id, setCookie: serializeCookie(cookieName, id, { ...cookie, maxAge: ttlSec }) };
  }

  return {
    async create(data, opts) {
      return createSession(data, opts?.userId);
    },
    async read(cookieHeader) {
      const id = getCookie(cookieHeader, cookieName);
      if (!id) return null;
      const env = await envelopeOf(id);
      return env ? env.data : null;
    },
    async update(id, data) {
      const env = await envelopeOf(id);
      const next: Envelope = { data, ...(env?.userId ? { userId: env.userId } : {}) };
      await store.set(k(id), JSON.stringify(next), ttlSec);
    },
    async destroy(cookieHeader) {
      const id = getCookie(cookieHeader, cookieName);
      if (id) {
        const env = await envelopeOf(id);
        await store.delete(k(id));
        if (env?.userId) await removeFromUserIndex(env.userId, id);
      }
      return clearCookie(cookieName, cookie);
    },
    async regenerate(cookieHeader, data) {
      const oldId = getCookie(cookieHeader, cookieName);
      if (!oldId) return null;
      const env = await envelopeOf(oldId);
      if (!env) return null;
      const nextData = data ?? env.data;
      // 旧セッションを失効させてから新規発行(ID を差し替え)
      await store.delete(k(oldId));
      if (env.userId) await removeFromUserIndex(env.userId, oldId);
      return createSession(nextData, env.userId);
    },
    async destroyAllForUser(userId) {
      const ids = await readUserIndex(userId);
      for (const id of ids) await store.delete(k(id));
      await store.delete(userKey(userId));
      return ids.length;
    },
    async listUserSessions(userId) {
      return readUserIndex(userId);
    },
  };
}
