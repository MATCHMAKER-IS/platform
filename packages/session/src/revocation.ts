/**
 * 強制ログアウト(締め出し)。
 *
 * 「今ログインしている人を今すぐ追い出す」を実現する。使う場面は決まっている:
 *
 *   - 退職・異動が発生した(`@platform/access-review` の停止手順と対で使う)
 *   - アカウントが乗っ取られた疑いがある
 *   - パスワードやロールを変更した(**古いセッションは古い権限のまま**)
 *   - 障害・情報漏えいで**全員をいったん止めたい**
 *
 * 【なぜセッションを消して回る方式にしないか】
 * `createServerSession` なら `destroyAllForUser` で消せるが、
 * **封緘クッキー方式(`createSession`)はサーバに記録が無く、消す対象が存在しない**。
 * クッキーは利用者の手元にあり、こちらから取り上げられない。
 *
 * そこで「**いつ以降に発行されたセッションなら有効か**」を 1 つの時刻として持つ。
 *
 * ```
 *   利用者ごと:  revoke:user:u42 = 2026-08-04T10:00
 *     → u42 の、10:00 より前に発行されたセッションはすべて無効
 *   全体:        revoke:all      = 2026-08-04T10:00
 *     → 全員の、10:00 より前に発行されたセッションが無効
 * ```
 *
 * 記録は**利用者 1 人につき 1 件**で済み、セッションが何個あっても変わらない。
 * 封緘クッキー方式にもストア方式にも同じように効く。
 *
 * 【締め出しは「追い出す」だけでは終わらない】
 * 失効させても、**本人はすぐ再ログインできる**。
 * 退職者や乗っ取られたアカウントを止めたいなら {@link RevocationGate.block} を使う。
 * こちらはログインそのものを拒否する。
 *
 * @packageDocumentation
 */
import { AppError, ErrorCode } from "@platform/core";

/**
 * 失効情報の保存先。`@platform/cache` の Cache や Redis クライアントが構造的に適合する。
 *
 * **プロセス内メモリは複数インスタンスで共有されない。**
 * 1 台で動かしているうちは {@link createMemoryRevocationStore} でよいが、
 * 複数台に増やしたら Redis 等へ差し替えること(片方のサーバだけ締め出しが効かない状態になる)。
 */
export interface RevocationStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec?: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** 締め出し一覧の表示に使う。持てない実装は省略可(その場合 `listBlocked` は空を返す)。 */
  keys?(prefix: string): Promise<string[]>;
}

/** 締め出しの内容。 */
export interface BlockRecord {
  /** 締め出した理由(**監査に残す**。利用者への表示にも使える)。 */
  reason: string;
  /** 締め出した時刻(epoch ms)。 */
  at: number;
  /** 自動解除する時刻(epoch ms)。**未指定なら手動で解除するまで続く**。 */
  until?: number;
  /** 操作した人(監査用)。 */
  by?: string;
}

/** 判定の結果。 */
export type AccessDecision =
  /** 通してよい。 */
  | { allowed: true }
  /** 通さない。`reason` は**利用者に見せてよい**文言にしてある。 */
  | { allowed: false; kind: "revoked" | "blocked"; reason: string; until?: number };

/** {@link createRevocationGate} の設定。 */
export interface RevocationGateOptions {
  /** 保存先。 */
  store: RevocationStore;
  /** 鍵の接頭辞(既定 `"revoke"`)。同じストアを他の用途と共有するとき分ける。 */
  prefix?: string;
  /**
   * 失効記録の保持期間(秒)。**セッションの絶対期限より長くする**。
   *
   * 短いと、記録が消えた後に**古いセッションが復活する**。
   * 既定は 400 日(クッキーの上限と揃えてある)。
   */
  ttlSec?: number;
  /** 現在時刻(テスト注入用)。 */
  now?: () => number;
}

/** 強制ログアウト(締め出し)の操作。 */
export interface RevocationGate {
  /**
   * 指定した利用者のセッションを**すべて失効**させる(今ログイン中の全端末)。
   *
   * ログインは引き続きできる。**ログインもさせたくないなら {@link RevocationGate.block}**。
   *
   * @param userId 対象の利用者
   * @returns この時刻より前に発行されたセッションが無効になる(epoch ms)
   */
  revokeUser(userId: string): Promise<number>;
  /**
   * **全員**のセッションを失効させる。障害・情報漏えい時の緊急停止用。
   *
   * **操作した本人も落ちる**。復旧手順を用意してから使うこと。
   *
   * @returns この時刻より前に発行されたセッションが無効になる(epoch ms)
   */
  revokeAll(): Promise<number>;
  /**
   * 利用者を締め出す(**セッション失効 + ログイン拒否**)。
   *
   * @param userId 対象の利用者
   * @param record 理由・自動解除時刻・操作者
   * @throws {@link @platform/core#AppError} コード `VALIDATION` — 理由が空の場合
   */
  block(userId: string, record: Omit<BlockRecord, "at">): Promise<void>;
  /** 締め出しを解除する(失効した既存セッションは戻らない)。 */
  unblock(userId: string): Promise<void>;
  /**
   * セッションを通してよいか判定する。**各リクエストで呼ぶ**。
   *
   * @param userId 利用者
   * @param issuedAt セッションの発行時刻(`session.inspect()` の `issuedAt`)
   * @returns 通してよいか
   */
  check(userId: string, issuedAt: number): Promise<AccessDecision>;
  /**
   * ログインしてよいか判定する。**ログイン処理の冒頭で呼ぶ**。
   *
   * `check` と分けているのは、締め出された人が**再ログインで戻れてしまう**のを防ぐため。
   *
   * @param userId 利用者
   * @returns 通してよいか
   */
  checkLogin(userId: string): Promise<AccessDecision>;
  /** 現在の締め出しを取得(無ければ null)。 */
  getBlock(userId: string): Promise<BlockRecord | null>;
  /** 締め出し中の一覧。`store.keys` が無い実装では空を返す。 */
  listBlocked(): Promise<{ userId: string; block: BlockRecord }[]>;
}

/**
 * 強制ログアウト(締め出し)の窓口を作る。
 *
 * @param options 保存先など
 * @returns 失効・締め出しの操作
 *
 * @example
 * ```ts
 * const gate = createRevocationGate({ store });
 *
 * // 各リクエスト
 * const info = session.inspect(req.headers.get("cookie"));
 * if (!info) return redirectToLogin();
 * const d = await gate.check(info.data.userId, info.issuedAt);
 * if (!d.allowed) return logoutWith(d.reason);
 *
 * // 退職者を止める
 * await gate.block("u42", { reason: "退職(2026-08-31)", by: "admin@example.com" });
 * ```
 */
export function createRevocationGate(options: RevocationGateOptions): RevocationGate {
  const { store, prefix = "revoke", ttlSec = 400 * 24 * 60 * 60, now = Date.now } = options;

  const userKey = (id: string): string => `${prefix}:user:${id}`;
  const blockKey = (id: string): string => `${prefix}:block:${id}`;
  const allKey = `${prefix}:all`;

  /** 数値として保存した時刻を読む。壊れていたら「失効なし」扱い。 */
  const readAt = async (key: string): Promise<number> => {
    const raw = await store.get(key);
    if (raw === null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  };

  const readBlock = async (userId: string): Promise<BlockRecord | null> => {
    const raw = await store.get(blockKey(userId));
    if (raw === null) return null;
    try {
      const b = JSON.parse(raw) as BlockRecord;
      // 期限つきの締め出しは、過ぎていたら**無いものとして扱う**。
      // 消す処理をここでしないのは、読み取りが書き込みを起こすと
      // 読み取り専用のレプリカで失敗するため(掃除は TTL に任せる)
      if (typeof b.until === "number" && b.until <= now()) return null;
      return b;
    } catch {
      return null;
    }
  };

  return {
    async revokeUser(userId) {
      const t = now();
      await store.set(userKey(userId), String(t), ttlSec);
      return t;
    },

    async revokeAll() {
      const t = now();
      await store.set(allKey, String(t), ttlSec);
      return t;
    },

    async block(userId, record) {
      // 理由の無い締め出しは、後から誰も解除の可否を判断できない
      if (record.reason.trim() === "") {
        throw new AppError(ErrorCode.VALIDATION, "締め出しには理由が必要です");
      }
      const t = now();
      const full: BlockRecord = { ...record, at: t };
      await store.set(blockKey(userId), JSON.stringify(full), ttlSec);
      // **締め出しは既存セッションの失効も伴う。**
      // ログインを止めるだけでは、今開いている画面はそのまま使えてしまう
      await store.set(userKey(userId), String(t), ttlSec);
    },

    async unblock(userId) {
      await store.delete(blockKey(userId));
    },

    async check(userId, issuedAt) {
      const block = await readBlock(userId);
      if (block !== null) {
        return {
          allowed: false,
          kind: "blocked",
          reason: block.reason,
          ...(block.until !== undefined ? { until: block.until } : {}),
        };
      }
      // 全体と個別の**遅い方**を基準にする
      const [all, user] = await Promise.all([readAt(allKey), readAt(userKey(userId))]);
      const cutoff = Math.max(all, user);
      if (cutoff > 0 && issuedAt < cutoff) {
        return { allowed: false, kind: "revoked", reason: "セッションが無効になりました。もう一度ログインしてください" };
      }
      return { allowed: true };
    },

    async checkLogin(userId) {
      const block = await readBlock(userId);
      if (block === null) return { allowed: true };
      return {
        allowed: false,
        kind: "blocked",
        reason: block.reason,
        ...(block.until !== undefined ? { until: block.until } : {}),
      };
    },

    getBlock: readBlock,

    async listBlocked() {
      if (store.keys === undefined) return [];
      const keys = await store.keys(`${prefix}:block:`);
      const out: { userId: string; block: BlockRecord }[] = [];
      for (const k of keys) {
        const userId = k.slice(`${prefix}:block:`.length);
        const b = await readBlock(userId);
        if (b !== null) out.push({ userId, block: b });
      }
      return out;
    },
  };
}

/**
 * プロセス内メモリの保存先(開発・テスト・単一インスタンス用)。
 *
 * **複数台に増やしたら使わないこと。** 片方のサーバだけ締め出しが効かず、
 * 「追い出したはずの人が、リロードすると戻ってくる」状態になる。
 *
 * @param now 現在時刻(テスト注入用)
 * @returns メモリ上の保存先
 */
export function createMemoryRevocationStore(now: () => number = Date.now): RevocationStore {
  const map = new Map<string, { value: string; expiresAt: number | null }>();
  const live = (k: string): string | null => {
    const e = map.get(k);
    if (e === undefined) return null;
    if (e.expiresAt !== null && e.expiresAt <= now()) { map.delete(k); return null; }
    return e.value;
  };
  return {
    get: async (k) => live(k),
    set: async (k, value, ttlSec) => {
      map.set(k, { value, expiresAt: ttlSec === undefined ? null : now() + ttlSec * 1000 });
    },
    delete: async (k) => { map.delete(k); },
    keys: async (p) => [...map.keys()].filter((k) => k.startsWith(p) && live(k) !== null),
  };
}
