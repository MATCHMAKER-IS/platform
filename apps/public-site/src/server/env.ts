/**
 * 公開サイトの環境変数。`process.env` を各所で直接読まず、ここへ集約する。
 * この画面は社内アプリ(internal-app)の API を参照して成り立つため、
 * 連携先 URL とトークンの設定が要になる。
 * @packageDocumentation
 */
import { parseEnv, optionalEnv, z } from "@platform/env";

export const env = parseEnv(
  z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  }),
);

/**
 * 連携・運用の設定。いずれも任意(未設定なら該当機能が無効になるだけで、サイトは表示できる)。
 * - PREVIEW_TOKEN: 下書きプレビューの合言葉。未設定ならプレビュー不可(既定で安全側)
 * - INTERNAL_API_BASE: 社内アプリの公開 API のベース URL(お客様の声などで参照)
 * - INTERNAL_INQUIRY_URL / INQUIRY_INTAKE_TOKEN: 問い合わせの転送先と認証トークン
 */
export const siteEnv = {
  PREVIEW_TOKEN: optionalEnv("PREVIEW_TOKEN"),
  INTERNAL_API_BASE: optionalEnv("INTERNAL_API_BASE"),
  INTERNAL_INQUIRY_URL: optionalEnv("INTERNAL_INQUIRY_URL"),
  INQUIRY_INTAKE_TOKEN: optionalEnv("INQUIRY_INTAKE_TOKEN"),
};
