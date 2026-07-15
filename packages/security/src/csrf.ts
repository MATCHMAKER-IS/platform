/**
 * CSRF 対策(署名付き double-submit cookie 方式、ステートレス)。
 *
 * トークンは `ランダム値.HMAC署名` の形。cookie とフォーム送信(ヘッダ/隠しフィールド)の
 * 両方に同じトークンを載せ、サーバは「両者一致」かつ「署名が正当(=自分が発行した)」を検証する。
 * セッションストア不要で、複数インスタンスでもそのまま動く。
 * @packageDocumentation
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError, ErrorCode } from "@platform/core";

/** CSRF トークンの発行・検証。 */
export interface Csrf {
  /** 新しい CSRF トークンを発行する(cookie とフォームの両方に載せる)。 */
  issue(): string;
  /** 送信トークンと cookie トークンを検証する。 */
  verify(submitted: string | null | undefined, cookie: string | null | undefined): boolean;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * CSRF ユーティリティを作る。
 * @param config `secret` … 署名鍵(`@platform/env` で検証した十分に長い秘密値)
 * @returns {@link Csrf}
 *
 * @example
 * ```ts
 * const csrf = createCsrf({ secret: env.CSRF_SECRET });
 * const token = csrf.issue();              // cookie + フォームにセット
 * csrf.verify(headerToken, cookieToken);   // 送信時に検証
 * ```
 */
export function createCsrf(config: { secret: string }): Csrf {
  const sign = (value: string) => createHmac("sha256", config.secret).update(value).digest("base64url");
  return {
    issue() {
      const value = randomBytes(24).toString("base64url");
      return `${value}.${sign(value)}`;
    },
    verify(submitted, cookie) {
      if (!submitted || !cookie) return false;
      if (!safeEqual(submitted, cookie)) return false; // double-submit 一致
      const [value, sig] = submitted.split(".");
      if (!value || !sig) return false;
      return safeEqual(sig, sign(value)); // 署名が正当 = 自分が発行した
    },
  };
}

/**
 * CSRF を検証し、不正なら例外を投げる(Route ハンドラで使う)。
 * @throws {@link @platform/core#AppError} `FORBIDDEN` — 検証失敗時(`@platform/http` が 403 に変換)
 */
export function assertCsrf(csrf: Csrf, submitted: string | null | undefined, cookie: string | null | undefined): void {
  if (!csrf.verify(submitted, cookie)) {
    throw new AppError(ErrorCode.FORBIDDEN, "CSRFトークンが無効です。ページを再読み込みしてください。");
  }
}

/** CSRF cookie の推奨名。 */
export const CSRF_COOKIE = "csrf";
/** CSRF を載せる推奨ヘッダ名。 */
export const CSRF_HEADER = "x-csrf-token";
