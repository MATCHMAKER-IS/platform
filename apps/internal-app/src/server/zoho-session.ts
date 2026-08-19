/**
 * 署名付きセッション(HMAC-SHA256)。Zoho ログイン後の本人情報を安全にクッキーへ。
 *
 * 【`@platform/session` との違い】
 *
 * **こちらは署名だけで、中身は暗号化していない。** ペイロードは base64 なので、
 * **クッキーを見れば email と roles が読める**——改ざんはできない(署名がある)が、
 * 端末を共有していると**他人に業務上の役割が見える**。
 * 基盤の `createSession` は暗号化するので中身が読めない。
 *
 * **ただしクッキーの属性は正しい**(`httpOnly` / `secure` / `sameSite: lax`)ので、
 * **JavaScript からは読めず、盗み見るには端末そのものを操作する**必要がある。
 * 危険は「共用端末で開発者ツールを開かれる」程度で、**緊急ではない**。
 *
 * 【移行するには】
 *
 * 入れ替えると**全員ログアウト**するので、次の順で進める(`docs/ops/HANDOVER.md` に詳細):
 *
 * 1. **読む側を両対応に** … 古い形式が読めなければ新しい形式も試す。まだ誰もログアウトしない
 * 2. **書く側を切り替え** … 新規のログインだけ新形式にする。既存は読めるので気づかれない
 * 3. **期限が切れるまで待つ** … `maxAge` を過ぎれば全員が新形式になる
 * 4. **古い側を消す**
 *
 * **3 を飛ばさないこと。** 飛ばすと 2 の直後に古いセッションが読めなくなり、
 * 結局全員ログアウトになる。
 *
 * @packageDocumentation
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** セッションのペイロード。 */
export interface SessionPayload {
  email: string;
  name?: string;
  zuid?: string;
  /** 付与ロール(RBAC)。 */
  roles: string[];
  /** 失効時刻(epoch 秒)。 */
  exp: number;
  /**
   * 発行時刻(epoch 秒)。
   *
   * **パスワードを変えたら、それ以前のセッションを失効させる**ために使う。
   * 署名付きのクッキーは中身を書き換えられないが、**盗まれたものは
   * 期限まで使える**。パスワードの再発行が「乗っ取りへの対処」に
   * ならないと困る(2026-08 に追加)。
   */
  iat?: number;
}

/**
 * **これは `@platform/session` の再実装であり、移行の判断が保留されている。**
 * (`check-app-rules --bypass` が 1 件として数えている唯一の箇所)
 *
 * 【いま何が違うか】
 * ここは **HMAC 署名だけ**で、ペイロードは base64 のまま。つまり
 * **クッキーを見れば email と roles が読める**(改ざんはできないが、中身は隠れていない)。
 * `@platform/session` の `createSession` は `deriveKey` + 封緘で**暗号化**する。
 *
 * 【なぜまだ移していないか】
 *  - トークンの形式が変わるため、**入れ替えた瞬間に全員がログアウト**する
 *  - `SESSION_SALT` が未設定(`createSession` は salt を必須にしている)
 *
 * 【移すときの順番】
 *  1. ~~`currentUser(request)` へ寄せ、クッキー解析を基盤に任せる~~
 *     **2026-08 完了**(249 か所。形式を変えないので単独で出せた)
 *  2. ~~`SESSION_SALT` を環境変数に足す(環境ごとに一意)~~
 *     **2026-08 完了**(`.env.example` に追加。`check-env-example` の
 *     `ALLOW_UNUSED` に「まだ使っていない」と理由付きで登録)
 *  3. 中身を `createSession` に差し替える。**利用者が少ない時間帯に出す**
 *
 * **残るのは 3 だけ。** 全員ログアウトを伴うので、出す時間帯を決めてから。
 * 環境ごとに別の塩にすること——**同じ塩だと検証環境のクッキーが本番でも通る**。
 */
const b64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/** ペイロードに署名してトークン("payload.signature")を返す。 */
export function signSession(payload: SessionPayload, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

/**
 * トークンを検証してペイロードを返す。改ざん/失効/不正なら null。
 *
 * @param token セッションのトークン
 * @param secret 署名鍵
 * @param previousSecret **1 つ前の鍵**(入れ替え中だけ渡す)。
 *   鍵を替えると**既に配ってあるトークンが全部無効になり、全員が即ログアウト**する。
 *   それでは「漏れたので今すぐ替える」ができない——**替えられない鍵は守りにならない**。
 *   ここに旧鍵を渡すと、**読むときだけ**旧鍵でも通す(発行は常に新しい鍵)。
 *   手順は `docs/ops/SECRET_ROTATION.md`。
 * @returns ペイロード。無効なら null
 */
export function verifySession(
  token: string,
  secret: string,
  previousSecret?: string,
): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];
  const actual = fromB64url(sig);
  // **新しい鍵を先に試す。** 大多数は新しい鍵なので、毎回 2 回計算しない
  const matches = (key: string): boolean => {
    const expected = createHmac("sha256", key).update(body).digest();
    // **長さが違うと timingSafeEqual が例外を投げる。** 先に見る
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  };
  const ok = matches(secret)
    || (previousSecret !== undefined && previousSecret !== "" && matches(previousSecret));
  if (!ok) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
