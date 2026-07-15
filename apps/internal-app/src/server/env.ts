/**
 * アプリの環境変数定義。基盤 `@platform/env` で起動時に検証する。
 * ここが「アプリ固有の設定(ロジック側)」の一例。
 * @packageDocumentation
 */
import { parseEnv, requireEnv, optionalEnv, assertSecretStrength, z } from "@platform/env";

export const env = parseEnv(
  z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url().describe("接続先 PostgreSQL"),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info").describe("ログの詳細度"),
    MAIL_FROM: z.string().email().describe("送信元メールアドレス"),
    SMTP_HOST: z.string().default("localhost").describe("SMTP サーバのホスト"),
    SMTP_PORT: z.coerce.number().default(1025).describe("SMTP サーバのポート"),
  }),
);

/**
 * サーバ専用の秘密値。`process.env` を直接読まず、@platform/env の口を通して
 * 起動時に検証する(欠けていれば CONFIG エラーで即座に失敗)。
 * - SESSION_SECRET: セッション署名鍵(必須)
 * - SECRET_MASTER_KEY: 秘密情報ストアの暗号鍵(未設定なら SESSION_SECRET を流用)
 *
 * ビルド時(next build)やテストでは環境変数が無いこともあるため、本番以外では
 * 欠けていても起動を止めず、開発用の既定値で継続する。
 */
function loadServerEnv(): { DATABASE_URL: string; SESSION_SECRET: string; SECRET_MASTER_KEY: string } {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    // 本番では必須。欠けていれば起動時に落とす(fail-fast)
    const required = requireEnv(["DATABASE_URL", "SESSION_SECRET"]);
    const loaded = {
      DATABASE_URL: required.DATABASE_URL,
      SESSION_SECRET: required.SESSION_SECRET,
      SECRET_MASTER_KEY: optionalEnv("SECRET_MASTER_KEY", required.SESSION_SECRET),
    };
    // 開発用の既定値・短すぎる鍵のまま本番公開する事故を防ぐ(error なら起動失敗)
    assertSecretStrength({ SESSION_SECRET: loaded.SESSION_SECRET, SECRET_MASTER_KEY: loaded.SECRET_MASTER_KEY }, { isProduction: true });
    return loaded;
  }
  const sessionSecret = optionalEnv("SESSION_SECRET", "dev-session-secret-change-me");
  return {
    DATABASE_URL: optionalEnv("DATABASE_URL"),
    SESSION_SECRET: sessionSecret,
    SECRET_MASTER_KEY: optionalEnv("SECRET_MASTER_KEY", sessionSecret),
  };
}

export const serverEnv = loadServerEnv();

/**
 * 機能ごとの任意設定。未設定なら該当機能が無効/モックになる(開発を止めない)。
 * `process.env` を各所で直読みせず、ここに集約する。
 */
export const featureEnv = {
  /** AI Gateway。未設定ならモック応答で動作。 */
  ANTHROPIC_API_KEY: optionalEnv("ANTHROPIC_API_KEY"),
  /** RAG のベクトル埋め込み。未設定ならハッシュ埋め込みで代替。 */
  OPENAI_API_KEY: optionalEnv("OPENAI_API_KEY"),
  /** FAQ の永続化。"prisma" で DB、それ以外はメモリ。 */
  FAQ_PERSISTENCE: optionalEnv("FAQ_PERSISTENCE"),
  /** 契約の永続化。"prisma" で DB、それ以外はメモリ。 */
  CONTRACT_PERSISTENCE: optionalEnv("CONTRACT_PERSISTENCE"),
  /** タスクの永続化。"prisma" で DB、それ以外はメモリ(DB 不要で試せる)。 */
  TASK_PERSISTENCE: optionalEnv("TASK_PERSISTENCE"),
  /** チャット・掲示板の永続化。"prisma" で DB、それ以外はメモリ。 */
  CHAT_PERSISTENCE: optionalEnv("CHAT_PERSISTENCE"),
  /** cron 実行の認証トークン。未設定なら該当エンドポイントは拒否。 */
  CRON_TOKEN: optionalEnv("CRON_TOKEN"),
  /** メンテナンスモードの許可 IP(カンマ区切り)。 */
  MAINTENANCE_ALLOW_IPS: optionalEnv("MAINTENANCE_ALLOW_IPS"),
  /** メンテナンスモードのバイパストークン。 */
  MAINTENANCE_BYPASS_TOKEN: optionalEnv("MAINTENANCE_BYPASS_TOKEN"),
  /** 無操作ログアウトの分(0 で無効)。 */
  IDLE_TIMEOUT_MINUTES: Number(optionalEnv("IDLE_TIMEOUT_MINUTES", "0")) || 0,
  /** アップロード済みファイルの公開 URL ベース。 */
  PUBLIC_UPLOADS_URL: optionalEnv("PUBLIC_UPLOADS_URL", "/uploads"),
  /** 公開サイトの URL(CMS のプレビューリンク生成に使う)。 */
  PUBLIC_SITE_URL: optionalEnv("PUBLIC_SITE_URL", "http://localhost:3001"),
  /** 公開サイトの下書きプレビュー用トークン(公開サイト側と一致させる)。 */
  PREVIEW_TOKEN: optionalEnv("PREVIEW_TOKEN"),
  /** 公開サイトからの問い合わせ受付トークン(公開サイト側と一致させる)。 */
  INQUIRY_INTAKE_TOKEN: optionalEnv("INQUIRY_INTAKE_TOKEN"),
  /** エラー監視(Sentry)の DSN。未設定なら監視無効。 */
  SENTRY_DSN: optionalEnv("SENTRY_DSN"),
  /** 通知リレーを止めるか("1" で無効。テスト・CI 用)。 */
  DISABLE_NOTIFY_RELAY: optionalEnv("DISABLE_NOTIFY_RELAY") === "1",
  /** システムアラートの送信先メール(カンマ区切り)。未設定なら送らない。 */
  ALERT_MAIL_TO: optionalEnv("ALERT_MAIL_TO"),
  /** システムアラートの Slack Webhook URL。未設定なら送らない。 */
  ALERT_SLACK_WEBHOOK: optionalEnv("ALERT_SLACK_WEBHOOK"),
  /** Platform Debugger を有効にするか("true" で有効)。**本番では必ず無効にすること**。 */
  DEBUG_TOOL: optionalEnv("DEBUG_TOOL") === "true" && optionalEnv("NODE_ENV") !== "production",
};

/** チャット等を Prisma で永続化するか。 */
export const useChatPrisma = featureEnv.CHAT_PERSISTENCE === "prisma";
