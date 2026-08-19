/**
 * 外部ログイン(OAuth)後のセッション。
 *
 * 【なぜ共通にするか】
 * Zoho・Google・Microsoft のどれでログインしても、
 * **クッキーに載せる形は同じ**(誰か・どこの誰か・何ができるか)。
 * プロバイダごとに作ると、**片方だけ暗号化を忘れる**、
 * **有効期限の扱いが違う**といった差が出る。
 *
 * @packageDocumentation
 */
import { createSession, type Session } from "./session";

/** ログインに使った先。 */
export type AuthProvider = "zoho" | "google" | "microsoft" | "local";

/**
 * 外部ログインで得られる本人情報。
 *
 * **`getUserInfo` の戻り値をそのまま入れない。** 各社は表示名や組織の情報も
 * 返すが、**クッキーに載せるのは判断に要るものだけ**にする
 * ——載せるほどクッキーが大きくなり、**毎回の通信に乗る**。
 */
export interface AuthSessionPayload {
  /** どこでログインしたか。 */
  provider: AuthProvider;
  /**
   * プロバイダ側の**恒久的な識別子**。
   *
   * Google の `sub`、Microsoft の `id`、Zoho の `zuid`。
   *
   * **メールアドレスで紐づけない。** メールは変わる(姓の変更・部署異動)し、
   * **前の持ち主が使っていたアドレスが再利用される**ことがある
   * ——退職者のアドレスを新入社員に割り当てると、**記録が繋がってしまう**。
   */
  subject: string;
  /** メールアドレス(**表示と連絡用**。紐づけには使わない)。 */
  email: string;
  /** 表示名。 */
  name?: string;
  /**
   * 組織のドメイン(Google の `hd` など)。
   *
   * **社内限定にするなら必ず確かめること。** Google は
   * **どのアカウントでもログインできる**ので、これを見ないと
   * **個人の Gmail で社内システムに入れる**。
   */
  domain?: string;
  /** 付与ロール(RBAC)。**プロバイダではなく自社で決める**。 */
  roles: string[];
}

/** {@link createAuthSession} の設定。 */
export interface AuthSessionOptions {
  /**
   * セッションの鍵(**環境変数から**)。
   *
   * **アプリごとに別の鍵にする。** 同じ鍵を使うと、
   * **一方のアプリのクッキーが他方でも通る**。
   */
  secret: string;
  /**
   * 鍵導出のソルト(**必須**・8 文字以上・アプリ/環境ごとに一意)。
   *
   * **既定値を持たせない。** 固定の共有既定値があると複数環境で同一鍵に
   * なり、レインボーテーブル攻撃に弱くなる(`@platform/crypto` の
   * `deriveKey` が必須化している理由と同じ)。
   *
   * 以前は `SessionConfig` に必須で渡す前提の項目がここに無く、
   * `createSession` を呼ぶと `salt` が `undefined` のまま渡って
   * 必ず例外を投げていた——ただし `createAuthSession` はどのアプリ
   * からも実際には呼ばれておらず、実害は無かった(2026-08、
   * 全 route.ts の一括型検査の延長で基盤パッケージ側も点検して発見)。
   */
  salt: string;
  /** クッキー名(既定 `"auth_session"`)。 */
  cookieName?: string;
  /**
   * 有効期間(秒。既定 8 時間)。
   *
   * **業務時間より少し長くする。** 短すぎると昼休みの後に切れ、
   * 長すぎると共用端末で放置されたときに使われる。
   */
  maxAgeSec?: number;
}

/**
 * 外部ログイン用のセッションを作る。
 *
 * **暗号化される**ので、クッキーを見ても中身は読めない
 * ——署名だけだと**端末を共有していると業務上の役割が見える**。
 *
 * @param options 鍵と有効期間
 * @returns セッション(`write` で発行、`read` で読み取り、`refresh` で延長)
 *
 * @example
 * ```ts
 * const session = createAuthSession({ secret: env.SESSION_SECRET });
 *
 * // Google のコールバック
 * const info = await getGoogleUserInfo(accessToken);
 * if (info.hd !== "example.co.jp") throw new Error("社外のアカウントです");
 * res.headers.set("set-cookie", session.write({
 *   provider: "google", subject: info.sub, email: info.email ?? "",
 *   domain: info.hd, roles: rolesOf(info.email),
 * }));
 *
 * // 各リクエスト
 * const me = currentSession(req, session);   // @platform/guard
 * ```
 */
/**
 * 外部ログイン(SSO)か(自前のパスワードログインでないか)。
 *
 * **管理機能を SSO に限る**ときに使う——パスワードは漏れうるが、
 * SSO なら**外部サービス側の 2 要素認証**が効く。
 *
 * **これだけで権限を決めない。** 「SSO でログインした」ことと
 * 「その操作をしてよい」ことは別で、**認可は `requirePermission` で見る**。
 * これは**追加の条件**として使うもの(2026-08 に追加)。
 *
 * @param payload セッションの中身
 * @returns 外部ログインなら true(`provider: "local"` なら false)
 *
 * @example
 * ```ts
 * const me = requireSession(req, session);
 * requirePermission(policy, me, "admin:write");
 * // **さらに** SSO を求める
 * if (!isExternalLogin(me)) {
 *   throw new AppError(ErrorCode.FORBIDDEN, "この操作は SSO でのログインが必要です");
 * }
 * ```
 */
export function isExternalLogin(payload: Pick<AuthSessionPayload, "provider">): boolean {
  return payload.provider !== "local";
}

/**
 * ログインの状態を**クッキーに安全に載せる**器を作る。
 *
 * **パスワードログインも SSO も同じ形**で扱います——分けると
 * 画面ごとに「どちらを見るか」の判断が要り、**必ずどこかで漏れます**。
 *
 * クッキーは **`httpOnly` + `sameSite: Lax`** です
 * ——JavaScript から読めず、他サイトからの遷移では送られません。
 *
 * **「この人はこれをしてよいか」は別**です（`@platform/auth`）。
 * ここが扱うのは「**誰でログインしているか**」だけです。
 *
 * @param options `secret`（署名鍵。**32 文字以上**）と `ttlMinutes`（有効期間）
 * @returns セッションの読み書きをする器
 */
export function createAuthSession(options: AuthSessionOptions): Session<AuthSessionPayload> {
  return createSession<AuthSessionPayload>({
    secret: options.secret,
    salt: options.salt,
    cookieName: options.cookieName ?? "auth_session",
    maxAgeSec: options.maxAgeSec ?? 8 * 60 * 60,
    cookie: {
      // **JavaScript から読めなくする。** XSS があっても盗まれない
      httpOnly: true,
      // **HTTPS だけに送る。** 社内網でも盗聴の可能性はある
      secure: true,
      // **他サイトからの遷移では送らない。** `Strict` にすると
      // 外部リンクから戻ったときにログアウトして見えるので `Lax`
      //
      // **表記は `Lax`(先頭大文字)。** `CookieOptions.sameSite` の型は
      // `"Strict" | "Lax" | "None"` だが、以前は小文字の `"lax"` を
      // 渡しており型エラーになっていた——ブラウザの実装は大文字小文字を
      // 区別しないことが多いが、仕様上の正しい表記ではなく、型検査も
      // 通っていなかった(2026-08、全 route.ts の一括型検査の延長で
      // 基盤パッケージ側も点検して発見)。
      sameSite: "Lax",
      path: "/",
    },
  });
}
