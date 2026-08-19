/**
 * OAuth の `state` と PKCE。
 *
 * 【なぜ要るか】
 * どのサービス(Zoho・Google・Microsoft)でも**やることは同じ**なのに、
 * アプリごとに書くと**片方だけ抜ける**。とくに PKCE は
 * **無くても動いてしまう**ので、書き忘れても気づけない。
 *
 * @packageDocumentation
 */
import { createHash, randomBytes } from "node:crypto";

/** 認可を始めるときに作る値。 */
export interface OAuthChallenge {
  /**
   * CSRF 対策の乱数。
   *
   * **認可 URL に載せ、クッキーにも保存する。** 戻ってきたときに
   * 一致を確かめる——一致しなければ、**他人が仕掛けた認可の戻り**。
   */
  state: string;
  /**
   * PKCE の検証子(**外に出さない**)。
   *
   * クッキーに保存し、トークン交換のときに送る。
   * **認可 URL には載せない**——載せたら意味が無い。
   */
  codeVerifier: string;
  /**
   * PKCE のチャレンジ(`codeVerifier` のハッシュ)。
   *
   * **こちらを認可 URL に載せる。** 盗まれても、
   * ここから `codeVerifier` は復元できない。
   */
  codeChallenge: string;
  /** チャレンジの方式(常に `"S256"`)。 */
  codeChallengeMethod: "S256";
}

/**
 * 認可を始めるための値を作る。
 *
 * **PKCE を必ず付ける。** 無くても認可は通るが、
 * **認可コードを盗まれるとそのままトークンに交換される**
 * ——リダイレクト URL はプロキシ・CDN・ブラウザ履歴に残り、
 * `Referer` で外部サイトに漏れることもある。
 * PKCE があれば、**`codeVerifier` を知らないと交換できない**。
 *
 * OAuth 2.1 では必須で、Zoho・Google・Microsoft とも対応している。
 *
 * @returns `state` と PKCE の一式
 *
 * @example
 * ```ts
 * const ch = createOAuthChallenge();
 *
 * // 認可 URL には state と codeChallenge だけを載せる
 * const url = buildGoogleAuthUrl({ ...cfg, state: ch.state,
 *   codeChallenge: ch.codeChallenge, codeChallengeMethod: ch.codeChallengeMethod });
 *
 * // codeVerifier はクッキーへ(**外に出さない**)
 * res.cookies.set("oauth_verifier", ch.codeVerifier, { httpOnly: true, secure: true, maxAge: 600 });
 * res.cookies.set("oauth_state", ch.state, { httpOnly: true, secure: true, maxAge: 600 });
 * ```
 */
export function createOAuthChallenge(): OAuthChallenge {
  // **32 バイト。** 短いと総当たりで当てられる
  const state = randomBytes(32).toString("base64url");
  // **43〜128 文字が仕様の範囲。** 32 バイトの base64url は 43 文字
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { state, codeVerifier, codeChallenge, codeChallengeMethod: "S256" };
}

/**
 * 戻ってきた `state` を確かめる。
 *
 * **時間一定で比べる。** 単純な `===` だと、
 * 一致する文字数で処理時間が変わり、**1 文字ずつ当てられる**。
 *
 * **どちらかが空なら不一致**として扱う——クッキーが消えていた場合に
 * 「空 === 空」で通してしまうのを防ぐ。
 *
 * @param received 戻ってきた `state`(クエリ文字列)
 * @param expected 保存しておいた `state`(クッキー)
 * @returns 一致すれば true
 */
export function verifyOAuthState(
  received: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (received === null || received === undefined || received === "") return false;
  if (expected === null || expected === undefined || expected === "") return false;
  if (received.length !== expected.length) return false;
  // **時間一定で比べる**(長さが同じ場合のみ意味がある)
  let diff = 0;
  for (let i = 0; i < received.length; i += 1) {
    diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
