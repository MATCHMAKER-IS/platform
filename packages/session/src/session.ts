/**
 * ステートレスなセッション(封緘クッキー方式)。
 * セッションデータを AES-256-GCM で暗号化してクッキーに格納する。サーバに状態を持たず、
 * 小さめのデータ(ユーザーID・権限など)向き。大きい/失効可能にしたい場合は
 * {@link createServerSession} を使う。
 * @packageDocumentation
 */
import { deriveKey, encrypt, decrypt } from "@platform/crypto";
import { getCookie, serializeCookie, clearCookie, type CookieOptions } from "./cookie";

/** {@link createSession} の設定。 */
export interface SessionConfig {
  /** 暗号化の秘密鍵(十分に長い秘密値。`@platform/env` で検証)。 */
  secret: string;
  /** クッキー名(既定 "session")。 */
  cookieName?: string;
  /** 有効期間(秒、既定 7 日)。絶対的な上限(活動しても延長されない)。 */
  maxAgeSec?: number;
  /**
   * 無操作タイムアウト(秒)。**既定 undefined = 無効**(無操作でもログアウトしない)。
   * 設定すると、最後の活動から この秒数を超えたセッションを失効扱いにする。
   * 活動のたびに {@link Session.refresh} を呼ぶことで無操作タイマーがスライドする。
   */
  idleTimeoutSec?: number;
  /** クッキー属性の上書き(dev では secure:false 等)。 */
  cookie?: CookieOptions;
}

/** 封緘クッキーセッションの操作。 */
export interface Session<T> {
  /** Cookie ヘッダからセッションを読む(無効/期限切れは null)。 */
  read(cookieHeader: string | null | undefined): T | null;
  /** データを封緘して Set-Cookie 文字列を返す。 */
  write(data: T): string;
  /**
   * 無操作タイマーをスライドさせる。有効なら最終活動時刻を今に更新した Set-Cookie を返す。
   * 絶対期限(maxAgeSec)は延長しない。無効/期限切れなら null(呼び出し側でログアウト処理)。
   * idleTimeoutSec 未設定時も呼べる(単にクッキーを再発行するだけ)。
   */
  refresh(cookieHeader: string | null | undefined): string | null;
  /** セッションを破棄する Set-Cookie 文字列を返す。 */
  destroy(): string;
}

/**
 * 封緘クッキーセッションを作る。
 * @example
 * ```ts
 * const session = createSession<{ userId: string }>({ secret: env.SESSION_SECRET });
 * // ログイン時: res に session.write({ userId }) を Set-Cookie
 * // 各リクエスト: const s = session.read(req.headers.get("cookie"));
 * ```
 */
interface SessionEnvelope<T> {
  data: T;
  /** 絶対期限(epoch ms)。 */
  exp: number;
  /** 発行時刻(epoch ms)。絶対上限の基準。 */
  iat?: number;
  /** 最終活動時刻(epoch ms)。無操作タイムアウトの基準。 */
  seen?: number;
}

/**
 * 署名付きセッションを作る(Cookie に値を入れる方式)。
 *
 * **値は署名される**ので改ざんできないが、**暗号化はされない**(Base64 を解けば中身は読める)。
 * パスワードや個人情報を入れないこと。**サーバ側に持ちたいなら {@link createServerSession}**。
 *
 * @param config.secret 署名鍵(**開発用の値のまま本番にしない**)
 * @param config.maxAgeSec 有効期間(秒)
 * @param config.cookieName Cookie 名
 * @returns セッション。`seal` で署名、`unseal` で検証
 */
export function createSession<T>(config: SessionConfig): Session<T> {
  const { secret, cookieName = "session", maxAgeSec = 60 * 60 * 24 * 7, idleTimeoutSec, cookie } = config;
  const key = deriveKey(secret);
  const now = () => Date.now();

  /** 生クッキーを検証し、有効ならエンベロープを返す(絶対期限 + 無操作の両方を判定)。 */
  function decode(cookieHeader: string | null | undefined): SessionEnvelope<T> | null {
    const raw = getCookie(cookieHeader, cookieName);
    if (!raw) return null;
    try {
      const env = JSON.parse(decrypt(raw, key)) as SessionEnvelope<T>;
      if (typeof env.exp !== "number" || env.exp < now()) return null; // 絶対期限切れ
      // 無操作タイムアウト(設定時のみ。旧クッキーで seen が無ければ判定しない)
      if (idleTimeoutSec !== undefined && typeof env.seen === "number" && now() - env.seen > idleTimeoutSec * 1000) {
        return null;
      }
      return env;
    } catch {
      return null; // 改ざん・鍵不一致・破損
    }
  }

  function seal(env: SessionEnvelope<T>): string {
    return serializeCookie(cookieName, encrypt(JSON.stringify(env), key), { ...cookie, maxAge: maxAgeSec });
  }

  return {
    read(cookieHeader) {
      return decode(cookieHeader)?.data ?? null;
    },
    write(data) {
      const t = now();
      return seal({ data, exp: t + maxAgeSec * 1000, iat: t, seen: t });
    },
    refresh(cookieHeader) {
      const env = decode(cookieHeader);
      if (!env) return null; // 無効/期限切れ/無操作超過 → 呼び出し側でログアウト
      // 絶対期限(exp/iat)は保持し、最終活動時刻だけ更新してスライド
      return seal({ ...env, seen: now() });
    },
    destroy() {
      return clearCookie(cookieName, cookie);
    },
  };
}
