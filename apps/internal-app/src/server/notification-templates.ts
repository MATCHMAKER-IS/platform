/**
 * 通知テンプレート（多言語）。承認・請求などのイベントの通知文面をテンプレート化し、利用者の言語で描画する。
 * {{var}} プレースホルダを差し込み、ロケール未定義は日本語にフォールバックする。純粋関数。
 * @packageDocumentation
 */

/** 対応ロケール。 */
export type Locale = "ja" | "en" | "zh" | "ko";

/** 1 イベントのテンプレート（ロケール別の title/body）。 */
export interface NotificationTemplate {
  event: string;
  locales: Record<Locale, { title: string; body: string }>;
}

/** イベント別テンプレート。 */
export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  "approval.requested": {
    event: "approval.requested",
    locales: {
      ja: { title: "承認依頼", body: "{{docType}} {{docNumber}}（{{amount}}円）の承認をお願いします。" },
      en: { title: "Approval requested", body: "Please approve {{docType}} {{docNumber}} (¥{{amount}})." },
      zh: { title: "审批请求", body: "请审批 {{docType}} {{docNumber}}（{{amount}}日元）。" },
      ko: { title: "승인 요청", body: "{{docType}} {{docNumber}}({{amount}}엔) 승인을 부탁드립니다." },
    },
  },
  "invoice.created": {
    event: "invoice.created",
    locales: {
      ja: { title: "請求書を作成しました", body: "請求書 {{number}}（{{billTo}}）を作成しました。" },
      en: { title: "Invoice created", body: "Invoice {{number}} for {{billTo}} has been created." },
      zh: { title: "已创建发票", body: "已为 {{billTo}} 创建发票 {{number}}。" },
      ko: { title: "청구서 생성됨", body: "{{billTo}}에 대한 청구서 {{number}}가 생성되었습니다." },
    },
  },
  "approval.decided": {
    event: "approval.decided",
    locales: {
      ja: { title: "承認結果", body: "{{docType}} {{docNumber}} は「{{result}}」になりました。" },
      en: { title: "Approval result", body: "{{docType}} {{docNumber}} was {{result}}." },
      zh: { title: "审批结果", body: "{{docType}} {{docNumber}} 已{{result}}。" },
      ko: { title: "승인 결과", body: "{{docType}} {{docNumber}}가 '{{result}}'되었습니다." },
    },
  },
};

/** {{var}} を値で置換する（未指定は空文字）。 */
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

/** イベントとロケールから通知文面を描画する。未知イベントは null、未定義ロケールは ja にフォールバック。 */
export function renderNotification(event: string, vars: Record<string, string | number>, locale: Locale): { title: string; body: string } | null {
  const tpl = NOTIFICATION_TEMPLATES[event];
  if (!tpl) return null;
  const loc = tpl.locales[locale] ?? tpl.locales.ja;
  return { title: fillTemplate(loc.title, vars), body: fillTemplate(loc.body, vars) };
}

/** 利用可能なイベント一覧（プレビュー用）。 */
export function templateEvents(): { event: string; locales: Locale[] }[] {
  return Object.values(NOTIFICATION_TEMPLATES).map((t) => ({ event: t.event, locales: Object.keys(t.locales) as Locale[] }));
}

// ── テンプレートの上書き（管理者編集）──

/** 1 テンプレートの上書き（イベント→ロケール→{title?, body?}）。 */
export type TemplateOverrides = Record<string, Partial<Record<Locale, { title?: string; body?: string }>>>;

/** 既定テンプレートに上書きをマージして解決する。 */
export function resolveTemplates(overrides: TemplateOverrides): Record<string, NotificationTemplate> {
  const out: Record<string, NotificationTemplate> = {};
  for (const [event, tpl] of Object.entries(NOTIFICATION_TEMPLATES)) {
    const ov = overrides[event] ?? {};
    const locales = {} as NotificationTemplate["locales"];
    for (const loc of Object.keys(tpl.locales) as Locale[]) {
      const base = tpl.locales[loc];
      const o = ov[loc] ?? {};
      locales[loc] = { title: o.title ?? base.title, body: o.body ?? base.body };
    }
    out[event] = { event, locales };
  }
  return out;
}

/** 解決済みテンプレート集合を使って描画する。 */
export function renderWithTemplates(templates: Record<string, NotificationTemplate>, event: string, vars: Record<string, string | number>, locale: Locale): { title: string; body: string } | null {
  const tpl = templates[event];
  if (!tpl) return null;
  const loc = tpl.locales[locale] ?? tpl.locales.ja;
  return { title: fillTemplate(loc.title, vars), body: fillTemplate(loc.body, vars) };
}

/** テンプレート上書きストア。 */
export interface TemplateStore {
  get(): Promise<TemplateOverrides>;
  update(overrides: TemplateOverrides): Promise<TemplateOverrides>;
}

/** インメモリ実装。 */
export function createMemoryTemplateStore(): TemplateStore {
  let overrides: TemplateOverrides = {};
  return {
    async get() {
      return overrides;
    },
    async update(next) {
      overrides = next;
      return overrides;
    },
  };
}

/** SettingRow の必要部分。 */
export interface TemplateRow {
  key: string;
  value: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface TemplateStoreDb {
  settingRow: {
    findUnique(args: { where: { key: string } }): Promise<TemplateRow | null>;
    upsert(args: { where: { key: string }; create: TemplateRow; update: { value: string } }): Promise<TemplateRow>;
  };
}

const TEMPLATE_KEY = "notificationTemplates";

/** Prisma 実装（単一 SettingRow に JSON 格納）。 */
export function createPrismaTemplateStore(db: TemplateStoreDb): TemplateStore {
  return {
    async get() {
      const row = await db.settingRow.findUnique({ where: { key: TEMPLATE_KEY } });
      if (!row) return {};
      try {
        return JSON.parse(row.value) as TemplateOverrides;
      } catch {
        return {};
      }
    },
    async update(overrides) {
      const value = JSON.stringify(overrides);
      await db.settingRow.upsert({ where: { key: TEMPLATE_KEY }, create: { key: TEMPLATE_KEY, value }, update: { value } });
      return overrides;
    },
  };
}
