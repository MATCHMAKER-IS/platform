/**
 * showcase の環境変数。
 *
 * 【なぜ集約するか】
 * **`process.env` を各所で直読みすると、何が要るか分からなくなる。**
 * 起動時にまとめて読めば、`.env.example` との対応も見える。
 *
 * 【ここは実運用のアプリではない】
 * 鍵はすべて任意で、**未設定でも起動する**。
 * 設定していない機能は、その画面が「未設定」と表示するだけ。
 * @packageDocumentation
 */
import { optionalEnv } from "@platform/env";

/**
 * 任意の設定。
 *
 * **既定値を持たせない。**
 * `?? "showcase-secret-change-me"` のような既定を書くと、
 * 設定し忘れたまま動いてしまい、**全環境が同じ鍵**になる。
 * 未設定なら未設定として扱い、その機能を止める。
 */
export const showcaseEnv = {
  /** CSRF トークンの署名鍵(登録・フォームのデモ)。 */
  get CSRF_SECRET(): string | undefined {
    return optionalEnv("CSRF_SECRET");
  },
  /** Slack からの受信を確かめる鍵。 */
  get SLACK_SIGNING_SECRET(): string | undefined {
    return optionalEnv("SLACK_SIGNING_SECRET");
  },
  /** AI のデモで使う鍵。 */
  get ANTHROPIC_API_KEY(): string | undefined {
    return optionalEnv("ANTHROPIC_API_KEY");
  },
  /** セッションの署名鍵(ログインのデモ)。 */
  get SESSION_SECRET(): string | undefined {
    return optionalEnv("SESSION_SECRET");
  },
  /** セッションの鍵導出に使う塩。**secret とは別の値**にする。 */
  get SESSION_SALT(): string | undefined {
    return optionalEnv("SESSION_SALT");
  },
  /** eKYC のデモで使う鍵。 */
  get TRUSTDOCK_KEY(): string | undefined {
    return optionalEnv("TRUSTDOCK_KEY");
  },
} as const;
