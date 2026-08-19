/**
 * アプリの環境変数定義。基盤 `@platform/env` で起動時に検証する。
 * ここが「アプリ固有の設定(ロジック側)」の一例。
 * @packageDocumentation
 */
import { parseEnv, requireEnv, optionalEnv, assertSecretStrength, isProductionRuntime, requiredAtRuntime, z } from "@platform/env";

/**
 * このアプリの環境変数。
 *
 * `@platform/env` の `parseEnv` で検証している(**基盤の実装を使う**)。
 * 同名なのは「アプリごとに必要な変数が違う」ため。基盤に定義を置くと、
 * 全アプリが全アプリの変数を要求することになる。
 */
export const env = parseEnv(
  z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /**
     * **どの環境か**(dev / staging / production)。
     *
     * **`NODE_ENV` とは別物。** `NODE_ENV` は Node と Next の**動作モード**で、
     * ビルド最適化やソースマップの有無を決める——**検証環境も本番と同じ
     * `production` でビルドする**(本番と違うものを検証しても意味がないため)。
     *
     * 「どの環境で動いているか」はそれとは別に要る:
     * - エラー追跡の振り分け(検証の失敗が本番の障害として鳴らないように)
     * - 通知やメールの宛先(検証から取引先へ送らないように)
     * - 危険な操作の可否(本番でだけ止める)
     *
     * **既定は `development`。** 設定し忘れたときに、**最も権限の弱い側**へ倒す。
     */
    APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
    // **ビルド中だけ既定値**。next build はページデータ収集でこのモジュールを読むため、
    // 必須のままだとビルドマシンに接続情報を置くまでビルドできない(実行時は検証が効く)
    DATABASE_URL: requiredAtRuntime(
      z.string().url(),
      z.string().default("postgresql://build@localhost:5432/build"),
    ).describe("接続先 PostgreSQL"),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info").describe("ログの詳細度"),
    MAIL_FROM: requiredAtRuntime(
      z.string().email(),
      z.string().default("build@example.com"),
    ).describe("送信元メールアドレス"),
    SMTP_HOST: z.string().default("localhost").describe("SMTP サーバのホスト"),
    SMTP_PORT: z.coerce.number().default(1025).describe("SMTP サーバのポート"),
    /**
     * セッションの有効秒数(既定 8 時間)。
     *
     * **`.env.example` には前からあったが、ここに無かった。**
     * そのため `env.SESSION_TTL_SEC` は型に存在せず、
     * `api/auth/login` と `zoho-auth` の 2 か所が型検査で落ちていた
     * (2026-08)。`@platform/env` を通していない値は
     * **検証もされない**ので、必ずここへ足すこと。
     */
    SESSION_TTL_SEC: z.coerce.number().int().positive().default(8 * 3600).describe("セッション有効秒数"),
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
function loadServerEnv(): {
  DATABASE_URL: string;
  SESSION_SECRET: string;
  SECRET_MASTER_KEY: string;
  SESSION_SECRET_PREVIOUS: string | undefined;
  SESSION_SALT: string;
} {
  // **ビルド中は必須チェックを見送る。** `next build` は NODE_ENV=production で動き、
  // ページデータ収集のためにこのモジュールを読み込む。ここで落とすと
  // **ビルドマシンに本番の秘密を置くまでビルドできない**(実行時に改めて検証される)
  const isProd = isProductionRuntime();
  if (isProd) {
    // 本番では必須。欠けていれば起動時に落とす(fail-fast)
    // **`SESSION_SALT` も必須にする。** 開発側と同じ既定値を本番でも使うと、
    // **検証環境で発行したクッキーが本番でも通ります**——
    // 環境ごとに違うことが、この値の唯一の役目なのに。
    // `assertSecretStrength` は名前に SECRET / TOKEN / PASSWORD / KEY を含むものしか
    // 見ないので、**SALT は素通りします**。だからここで止めます。
    const required = requireEnv(["DATABASE_URL", "SESSION_SECRET", "SESSION_SALT"]);
    const loaded = {
      DATABASE_URL: required.DATABASE_URL,
      SESSION_SECRET: required.SESSION_SECRET,
      SECRET_MASTER_KEY: optionalEnv("SECRET_MASTER_KEY", required.SESSION_SECRET),
      /** 1 つ前のセッション鍵（入れ替え中だけ設定する。`SECRET_ROTATION.md`）。 */
      SESSION_SECRET_PREVIOUS: optionalEnv("SESSION_SECRET_PREVIOUS"),
      /** セッションの**塩**（環境ごとに必ず別の値。上の `requireEnv` で必須）。 */
      SESSION_SALT: required.SESSION_SALT,
    };
    // 開発用の既定値・短すぎる鍵のまま本番公開する事故を防ぐ(error なら起動失敗)。
    //
    // **`process.env` をまるごと渡す。** 2026-08 まで 2 つだけを渡しており、
    // **`ZOHO_CLIENT_SECRET` などの連携の鍵は検証されて**いなかった——
    // `change-me` のまま本番へ出しても起動できてしまう。
    // `checkSecretStrength` は**名前で秘密を見分ける**(`SECRET` / `TOKEN` /
    // `PASSWORD` / `KEY` を含むもの)ので、渡す側で選ぶ必要はない。
    // **未設定のものは無視される**(任意の連携は設定しないことがある)。
    assertSecretStrength(
      { ...process.env, SESSION_SECRET: loaded.SESSION_SECRET, SECRET_MASTER_KEY: loaded.SECRET_MASTER_KEY },
      { isProduction: true },
    );
    return loaded;
  }
  const sessionSecret = optionalEnv("SESSION_SECRET", "dev-session-secret-change-me");
  return {
    DATABASE_URL: optionalEnv("DATABASE_URL"),
    SESSION_SECRET: sessionSecret,
    SECRET_MASTER_KEY: optionalEnv("SECRET_MASTER_KEY", sessionSecret),
    /**
     * **1 つ前のセッション鍵**(入れ替え中だけ設定する)。
     *
     * 鍵を替えると**全員が即ログアウト**する。これを設定しておくと、
     * **読むときだけ旧鍵も試す**ので、利用者は気づかないまま新しい鍵へ移る。
     * **有効期間より長く待ってから消すこと**(消した瞬間に、残っていた人が落ちる)。
     * 手順は `docs/ops/SECRET_ROTATION.md`。
     */
    SESSION_SECRET_PREVIOUS: optionalEnv("SESSION_SECRET_PREVIOUS"),
    /**
     * セッションの**塩**(`@platform/session` の `createSession` が必須にしている)。
     *
     * **環境ごとに必ず別の値にすること。** 同じ塩だと、
     * **検証環境で発行したクッキーが本番でも通ります**。
     *
     * `.env.example` には前からありましたが、**ここに無かったので読めません**でした
     * (2026-08)——`zoho-session` を暗号化へ移す手順②が、実は未完でした。
     */
    SESSION_SALT: optionalEnv("SESSION_SALT", "dev-session-salt-change-me"),
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
  /** 契約の永続化。"prisma" で DB、それ以外はメモリ。 */
  /** タスクの永続化。"prisma" で DB、それ以外はメモリ(DB 不要で試せる)。 */
  /** チャット・掲示板の永続化。"prisma" で DB、それ以外はメモリ。 */
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
  /**
   * 取引先向けメールで許可するドメイン(カンマ区切り)。
   *
   * **開発・ステージング環境からの誤送信を防ぐ**ため。本番では
   * `isProductionRuntime()` が true なので制限しない(制限が要らない)。
   */
  ALLOWED_MAIL_DOMAINS: optionalEnv("ALLOWED_MAIL_DOMAINS"),
  /** アプリの公開 URL(配信停止リンクの生成に使う)。 */
  APP_BASE_URL: optionalEnv("APP_BASE_URL", "http://localhost:3000"),
  /**
   * Web Push の VAPID 鍵(3 つ揃って初めて有効になる)。
   *
   * **`generateVapidKeys()` で 1 度だけ生成する。** 毎回生成すると、
   * 既存の購読(公開鍵で紐付いている)が全部無効になる。
   */
  VAPID_PUBLIC_KEY: optionalEnv("VAPID_PUBLIC_KEY"),
  VAPID_PRIVATE_KEY: optionalEnv("VAPID_PRIVATE_KEY"),
  VAPID_SUBJECT: optionalEnv("VAPID_SUBJECT"),
  /**
   * **トレースの送り先**(OTLP。例 `http://collector:4318/v1/traces`)。
   *
   * **未設定なら送りません。** その場合トレースは構造化ログにだけ出ます
   * ——`docker logs` で追えますが、**コンテナを入れ替えると消えます**。
   *
   * 送り先を決めていない間は、これで構いません。決めたときに
   * **この 1 行を足すだけ**で送れるようにしてあります(2026-08 に配線)。
   * Grafana Cloud / Tempo / Jaeger / Datadog など OTLP を受けるものなら何でも。
   *
   * **送信の失敗でアプリは止まりません。** 監視のために本業が止まっては本末転倒
   * ——失敗は捨てて、件数だけログに残します。
   */
  OTLP_ENDPOINT: optionalEnv("OTLP_ENDPOINT"),
  /**
   * OTLP の追加ヘッダ(認証トークン等)。`名前: 値` をカンマ区切りで。
   *
   * 例: `Authorization: Bearer xxx,X-Scope-OrgID: 1`
   *
   * **ログに出しません**(`@platform/env` が秘密として扱う名前にしてある)。
   */
  OTLP_HEADERS: optionalEnv("OTLP_HEADERS"),
  /**
   * Twilio(SMS-OTP 用)。3 つ揃って初めて有効になる。
   *
   * **TOTP を設定していない人向けの代替 2FA。** 未設定でも起動は失敗しない
   * ——電話番号を登録していない・SMS が使えない人は、これまでどおり
   * 2FA なしでログインできる。
   */
  TWILIO_ACCOUNT_SID: optionalEnv("TWILIO_ACCOUNT_SID"),
  TWILIO_AUTH_TOKEN: optionalEnv("TWILIO_AUTH_TOKEN"),
  TWILIO_FROM_NUMBER: optionalEnv("TWILIO_FROM_NUMBER"),
  /**
   * 公開サイトの URL(CMS のプレビューリンク生成に使う)。
   *
   * **本番で既定値のままだと、プレビューが `localhost` を指して開けない。**
   * `assertProductionUrls()` が起動時に確かめる(2026-08 に追加)。
   */
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
  /**
   * **開発専用ログイン**を有効にするか(`/api/auth/dev-login`)。
   *
   * このアプリのログインは Zoho SSO だけなので、鍵が無いとローカルで何も試せない。
   * **明示的に "1" を設定したときだけ**有効(既定は無効)。
   * 本番では `isProductionRuntime()` 側でも塞いでいる(二重の守り)。
   */
  DEV_LOGIN: optionalEnv("DEV_LOGIN") ?? "",

  // ── 口座残高(balance-app から統合)──
  /** freee のアプリ情報。**未設定なら見本データで動く**(画面に明示する)。 */
  FREEE_CLIENT_ID: optionalEnv("FREEE_CLIENT_ID") ?? "",
  FREEE_CLIENT_SECRET: optionalEnv("FREEE_CLIENT_SECRET") ?? "",
  FREEE_REFRESH_TOKEN: optionalEnv("FREEE_REFRESH_TOKEN") ?? "",
  /**
   * 事業所 ID。**数値で持つ。** freee の API は数値を要求するので、
   * 使う側で毎回変換すると変換漏れが起きる。未設定は 0(= 使えない)。
   */
  /**
   * 永続化の方式。**既定は DB。**
   *
   * 以前は `CHAT_PERSISTENCE` / `FAQ_PERSISTENCE` / `CONTRACT_PERSISTENCE` /
   * `TASK_PERSISTENCE` の 4 つに分かれ、**どれも既定がメモリ**だった。
   * `DATABASE_URL` は必須なのに DB を使わない、という食い違いがあり、
   * 「シードを入れたのに画面が空」という事故が起きた(2026-08)。
   *
   * さらに `CHAT_PERSISTENCE` は**名前と実態が合っていなかった**
   * (チャットと無関係な取引先・通知・監査など 51 のストアを切り替えていた)。
   *
   * 実験用にメモリで動かしたいときだけ `PERSISTENCE=memory` を指定する。
   */
  PERSISTENCE: optionalEnv("PERSISTENCE") ?? "",
  FREEE_COMPANY_ID: Number(optionalEnv("FREEE_COMPANY_ID") ?? "0"),
  /** 定期取得の入口を守る鍵。**未設定なら実行できない**(開けっ放しにしない)。 */
  COLLECT_SECRET: optionalEnv("COLLECT_SECRET") ?? "",
};

/**
 * DB に保存するか。**既定は保存する。**
 *
 * `PERSISTENCE=memory` のときだけメモリ実装になる(再起動で消えるので、
 * 開発の使い捨て以外には向かない)。
 */
export const usePrisma = featureEnv.PERSISTENCE !== "memory";

/**
 * **本番で開発用の既定値が残っていないか**を確かめる。
 *
 * `assertSecretStrength` は**秘密だけ**を見る(名前に `SECRET` / `TOKEN` /
 * `PASSWORD` / `KEY` を含むもの)。**URL は対象外**なので、
 * `PUBLIC_SITE_URL` が `http://localhost:3001` のままでも通ってしまう。
 *
 * 実害は**その場では出ない**——CMS のプレビューを押した人が
 * 「開かない」と気づくまで分からない。**起動時に止める**方が早い。
 */
function assertProductionUrls(): void {
  if (!isProductionRuntime()) return;
  const localhost = Object.entries(featureEnv)
    .filter(([, v]) => typeof v === "string" && /localhost|127\.0\.0\.1/.test(v))
    .map(([k]) => k);
  if (localhost.length > 0) {
    throw new Error(
      `本番なのに localhost を指す設定があります: ${localhost.join(", ")}` +
      "(プレビューやリンクが開けません。環境変数を設定してください)",
    );
  }
}

assertProductionUrls();


/**
 * freee に繋げる状態か。
 *
 * **繋がらないときは見本データで動かす。** 鍵が無いと画面が真っ白になり、
 * 「壊れているのか設定が足りないのか」が分からなくなるため。
 */
export const canUseFreee = Boolean(
  featureEnv.FREEE_CLIENT_ID && featureEnv.FREEE_CLIENT_SECRET
  && featureEnv.FREEE_REFRESH_TOKEN && featureEnv.FREEE_COMPANY_ID,
);
