/**
 * ステートレスなセッション(封緘クッキー方式)。
 * セッションデータを AES-256-GCM で暗号化してクッキーに格納する。サーバに状態を持たず、
 * 小さめのデータ(ユーザーID・権限など)向き。大きい/失効可能にしたい場合は
 * {@link createServerSession} を使う。
 * @packageDocumentation
 */
import { AppError, ErrorCode } from "@platform/core";
import { deriveKey, encrypt, decrypt } from "@platform/crypto";
import { getCookie, serializeCookie, clearCookie, type CookieOptions } from "./cookie";

/** {@link createSession} の設定。 */
export interface SessionConfig {
  /** 暗号化の秘密鍵(十分に長い秘密値。`@platform/env` で検証)。 */
  secret: string;
  /**
   * 鍵導出のソルト(**必須**・8 文字以上)。**アプリ/環境ごとに一意の値**を設定する。
   *
   * @remarks
   * 既定値を持たせない。固定の共有既定値があると **複数環境で同一鍵になり**、
   * レインボーテーブル攻撃に弱くなる({@link @platform/crypto#deriveKey} が必須化している理由)。
   * 本番は `env.SESSION_SALT` のような環境変数から渡すこと。
   */
  salt: string;
  /** クッキー名(既定 "session")。 */
  cookieName?: string;
  /**
   * 有効期間(秒、既定 7 日)。絶対的な上限(活動しても延長されない)。
   *
   * **`0` は無制限**(期限で切らない)。管理画面から設定させる場合、
   * 入力欄を空にできないことが多いので `0` を「無制限」の入口として受ける。
   */
  maxAgeSec?: number;
  /**
   * 無操作タイムアウト(秒)。**既定は無制限**(無操作でもログアウトしない)。
   * 設定すると、最後の活動から この秒数を超えたセッションを失効扱いにする。
   * 活動のたびに {@link Session.refresh} を呼ぶことで無操作タイマーがスライドする。
   *
   * **`0` と `undefined` はどちらも無制限。**
   * 以前は `0` を渡すと「経過時間 > 0」が常に成立し、**設定した瞬間に全員が
   * ログアウトする**状態だった。管理画面で「0 = 無制限」と案内しながら
   * 実装が即失効では、設定した本人も締め出される。
   */
  idleTimeoutSec?: number;
  /** クッキー属性の上書き(dev では secure:false 等)。 */
  cookie?: CookieOptions;
}

/**
 * クッキーに設定できる最大の寿命(秒)。
 *
 * 「無制限」でも**クッキー自体には有限の値を入れる**。
 * 主要ブラウザは 400 日を超える寿命を 400 日へ丸めるため、それに合わせる
 * (Infinity を入れると不正な属性になり、クッキーごと捨てられる)。
 */
export const MAX_COOKIE_AGE_SEC = 400 * 24 * 60 * 60;

/**
 * 秒数の設定を「上限(ミリ秒)」に直す。**`0` は無制限。**
 *
 * @param sec 設定値(未指定なら `fallbackSec`)
 * @param fallbackSec 未指定時の既定。`null` なら未指定も無制限
 * @param label 例外メッセージに出す設定名
 * @returns 上限(ミリ秒)。**無制限なら `null`**
 * @throws {@link @platform/core#AppError} コード `CONFIG` — 負の値の場合
 */
function limitMs(sec: number | undefined, fallbackSec: number | null, label: string): number | null {
  const v = sec ?? fallbackSec;
  if (v === null) return null;
  // 負の値は「無制限のつもり」か「単位の間違い」か区別できない。
  // **黙って無制限にすると、意図せず期限が消える**ので起動時に落とす
  if (!Number.isFinite(v) || v < 0) {
    throw new AppError(ErrorCode.CONFIG, `${label} は 0 以上の秒数で指定してください(0 は無制限)`, {
      details: { [label]: sec },
    });
  }
  return v === 0 ? null : v * 1000;
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
  /**
   * 中身に加えて**発行時刻などのメタ情報**を返す(無効なら null)。
   *
   * 強制ログアウト(失効)の判定には**いつ発行されたか**が要る。
   * `read` は中身しか返さないので、締め出しを実装するときはこちらを使う。
   *
   * @see {@link @platform/session#createRevocationGate}
   */
  inspect(cookieHeader: string | null | undefined): SessionInfo<T> | null;
}

/** {@link Session.inspect} が返すメタ情報つきのセッション。 */
export interface SessionInfo<T> {
  /** セッションの中身。 */
  data: T;
  /** 発行時刻(epoch ms)。**失効判定の基準**。 */
  issuedAt: number;
  /** 最終活動時刻(epoch ms)。 */
  lastSeenAt: number;
  /** 絶対期限(epoch ms)。**無制限なら null**。 */
  expiresAt: number | null;
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
  /** 絶対期限(epoch ms)。**無制限なら null**。 */
  exp: number | null;
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
  const { secret, salt, cookieName = "session", maxAgeSec, idleTimeoutSec, cookie } = config;
  // **0 は無制限。** 既定は絶対期限 7 日 / 無操作は無制限
  const maxAgeMs = limitMs(maxAgeSec, 60 * 60 * 24 * 7, "maxAgeSec");
  const idleMs = limitMs(idleTimeoutSec, null, "idleTimeoutSec");
  // 無制限でもクッキーには有限の値を入れる(属性が不正だと丸ごと捨てられる)
  const cookieMaxAge = maxAgeMs === null ? MAX_COOKIE_AGE_SEC : Math.floor(maxAgeMs / 1000);
  // salt は必須(deriveKey が 8 文字未満なら AppError を投げる)
  const key = deriveKey(secret, salt);
  const now = () => Date.now();

  /** 生クッキーを検証し、有効ならエンベロープを返す(絶対期限 + 無操作の両方を判定)。 */
  function decode(cookieHeader: string | null | undefined): SessionEnvelope<T> | null {
    const raw = getCookie(cookieHeader, cookieName);
    if (!raw) return null;
    try {
      const env = JSON.parse(decrypt(raw, key)) as SessionEnvelope<T>;
      // exp は無制限のとき null。数値なら期限として判定する
      if (env.exp !== null && (typeof env.exp !== "number" || env.exp < now())) return null;
      // 無操作タイムアウト(設定時のみ。旧クッキーで seen が無ければ判定しない)
      if (idleMs !== null && typeof env.seen === "number" && now() - env.seen > idleMs) {
        return null;
      }
      return env;
    } catch {
      return null; // 改ざん・鍵不一致・破損
    }
  }

  function seal(env: SessionEnvelope<T>): string {
    return serializeCookie(cookieName, encrypt(JSON.stringify(env), key), { ...cookie, maxAge: cookieMaxAge });
  }

  return {
    read(cookieHeader) {
      return decode(cookieHeader)?.data ?? null;
    },
    write(data) {
      const t = now();
      return seal({ data, exp: maxAgeMs === null ? null : t + maxAgeMs, iat: t, seen: t });
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
    inspect(cookieHeader) {
      const env = decode(cookieHeader);
      if (!env) return null;
      // iat / seen は古いクッキーに無いことがある。**発行時刻が分からないものは
      // 「ずっと前に発行された」とみなす**(失効の判定で取りこぼさないため)
      return {
        data: env.data,
        issuedAt: typeof env.iat === "number" ? env.iat : 0,
        lastSeenAt: typeof env.seen === "number" ? env.seen : 0,
        expiresAt: env.exp,
      };
    },
  };
}
