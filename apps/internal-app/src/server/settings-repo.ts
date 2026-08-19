/**
 * システム設定。会社情報・締め月・税率・メール既定などを画面から管理する（管理画面）。
 * 上書き値はキー・バリューで保持し、既定値とマージして解決する。
 * @packageDocumentation
 */

/** アプリ設定。 */
export interface AppSettings {
  companyName: string;
  /** 決算月（1-12）。 */
  fiscalClosingMonth: number;
  /** 消費税率（例 0.10）。 */
  consumptionTaxRate: number;
  /** 送信メールの既定 From。 */
  mailFrom: string;
  /** 請求書番号の接頭辞。 */
  invoicePrefix: string;
  /** 監査アラートの Slack Webhook URL（空なら無効）。 */
  alertSlackWebhook: string;
  /** 監査アラートの汎用 Webhook URL（空なら無効）。 */
  alertWebhookUrl: string;
  /** 承認で署名必須となる金額のしきい値（円）。0 以下なら署名不要。 */
  signatureThreshold: number;
}

/** 既定値。 */
export const SETTINGS_DEFAULTS: AppSettings = {
  companyName: "サンプル株式会社",
  fiscalClosingMonth: 3,
  consumptionTaxRate: 0.1,
  mailFrom: "no-reply@example.com",
  invoicePrefix: "INV-",
  alertSlackWebhook: "",
  alertWebhookUrl: "",
  signatureThreshold: 1000000,
};

const clampMonth = (n: number): number => (Number.isFinite(n) && n >= 1 && n <= 12 ? Math.floor(n) : SETTINGS_DEFAULTS.fiscalClosingMonth);
const clampRate = (n: number): number => (Number.isFinite(n) && n >= 0 && n <= 1 ? n : SETTINGS_DEFAULTS.consumptionTaxRate);

/** 上書き（文字列 KV）を既定値にマージして型付き設定に解決する。不正値は既定へフォールバック。 */
export function resolveSettings(overrides: Record<string, string>): AppSettings {
  return {
    companyName: overrides.companyName?.trim() || SETTINGS_DEFAULTS.companyName,
    fiscalClosingMonth: overrides.fiscalClosingMonth !== undefined ? clampMonth(Number(overrides.fiscalClosingMonth)) : SETTINGS_DEFAULTS.fiscalClosingMonth,
    consumptionTaxRate: overrides.consumptionTaxRate !== undefined ? clampRate(Number(overrides.consumptionTaxRate)) : SETTINGS_DEFAULTS.consumptionTaxRate,
    mailFrom: overrides.mailFrom?.trim() || SETTINGS_DEFAULTS.mailFrom,
    invoicePrefix: overrides.invoicePrefix ?? SETTINGS_DEFAULTS.invoicePrefix,
    alertSlackWebhook: overrides.alertSlackWebhook?.trim() || SETTINGS_DEFAULTS.alertSlackWebhook,
    alertWebhookUrl: overrides.alertWebhookUrl?.trim() || SETTINGS_DEFAULTS.alertWebhookUrl,
    signatureThreshold: overrides.signatureThreshold !== undefined ? (Number.isFinite(Number(overrides.signatureThreshold)) && Number(overrides.signatureThreshold) >= 0 ? Number(overrides.signatureThreshold) : SETTINGS_DEFAULTS.signatureThreshold) : SETTINGS_DEFAULTS.signatureThreshold,
  };
}

/** 設定ストア。 */
export interface SettingsStore {
  get(): Promise<AppSettings>;
  update(patch: Record<string, string>): Promise<AppSettings>;
}

/** インメモリ実装。 */
export function createMemorySettingsStore(): SettingsStore {
  const overrides: Record<string, string> = {};
  return {
    async get() {
      return resolveSettings(overrides);
    },
    async update(patch) {
      // **知らないキーは受け取らない。**
      // 任意のキーを保存できると、設定が際限なく増えて何が効いているか
      // 分からなくなる。値の妥当性は `resolveSettings` が見る(2026-08)
      for (const [k, v] of Object.entries(patch)) {
        if (!(k in SETTINGS_DEFAULTS)) continue;
        overrides[k] = String(v);
      }
      return resolveSettings(overrides);
    },
  };
}

// ── Prisma 実装（キー・バリュー行）──

/** SettingRow の必要部分。 */
export interface SettingRow {
  key: string;
  value: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface SettingsStoreDb {
  settingRow: {
    // **`orderBy` が型に無かった。** `overrides` がキー順を指定している
    // のに型定義は空オブジェクトしか許していなかった(2026-08、同種の
    // パターンを全 route.ts の一括型検査で発見)。
    findMany(args?: { orderBy?: { key: "asc" } }): Promise<SettingRow[]>;
    upsert(args: { where: { key: string }; create: SettingRow; update: { value: string } }): Promise<SettingRow>;
  };
}

/** Prisma 実装。 */
export function createPrismaSettingsStore(db: SettingsStoreDb): SettingsStore {
  async function overrides(): Promise<Record<string, string>> {
    // **キー順に並べる**(無指定だと DB の返す順は不定で、管理画面の一覧が毎回変わる)
    const rows = await db.settingRow.findMany({ orderBy: { key: "asc" } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
  return {
    async get() {
      return resolveSettings(await overrides());
    },
    async update(patch) {
      // **知らないキーは受け取らない**(メモリ実装と揃える)
      for (const [k, v] of Object.entries(patch)) {
        if (!(k in SETTINGS_DEFAULTS)) continue;
        // query-in-loop: 設定は数個。まとめても往復が 1 回減るだけで、
        // **どのキーで失敗したか**が分からなくなる方が損
        await db.settingRow.upsert({
          where: { key: k }, create: { key: k, value: String(v) }, update: { value: String(v) },
        });
      }
      return resolveSettings(await overrides());
    },
  };
}
