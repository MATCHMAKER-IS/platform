/**
 * 機能アクセス制御。各機能（モジュール）を役割で使える/使えない・表示/非表示に切り替える。
 * 既存の権限（APP_POLICY）による制御に加え、管理者が実行時に役割単位で有効/無効を設定できる層。
 * @packageDocumentation
 */

/** 切り替え可能な機能（ナビ／モジュール単位）。 */
export const FEATURE_CATALOG: { key: string; label: string; href: string }[] = [
  { key: "dashboard", label: "ダッシュボード", href: "/dashboard" },
  { key: "mailbox", label: "受信箱", href: "/mailbox" },
  { key: "invoices", label: "請求", href: "/invoices" },
  { key: "purchases", label: "発注", href: "/purchase-orders" },
  { key: "expenses", label: "経費", href: "/expenses" },
  { key: "approvals", label: "承認", href: "/approvals" },
  { key: "accounting", label: "会計", href: "/accounting" },
  { key: "closing", label: "決算", href: "/closing" },
  { key: "partners", label: "取引先", href: "/partners" },
  { key: "inquiries", label: "問い合わせ", href: "/inquiries" },
  { key: "audit", label: "監査", href: "/audit" },
  { key: "surveys", label: "アンケート", href: "/surveys" },
  { key: "reviews", label: "口コミ", href: "/reviews" },
  { key: "signatures", label: "サイン", href: "/signatures" },
];

const FEATURE_KEYS = new Set(FEATURE_CATALOG.map((f) => f.key));

/** 機能ごとのアクセス規則。enabled=全体の有効/無効、roles=許可する役割（空なら全役割に許可）。 */
export interface FeatureRule {
  enabled: boolean;
  roles: string[];
  /** 機能内の操作（create/delete/export 等）ごとの許可役割。未指定の操作は機能アクセスと同じ扱い。 */
  actions?: Record<string, string[]>;
}

/** 代表的な操作の種類。 */
export const ACTION_KINDS = ["view", "create", "update", "delete", "export"] as const;

/** 既定は全機能を有効・全役割に許可。 */
export function defaultRule(): FeatureRule {
  return { enabled: true, roles: [] };
}

/** 保存された上書き（feature→規則の一部）を既定にマージして全機能の規則を解決する。 */
export function resolveFeatureRules(overrides: Record<string, Partial<FeatureRule>>): Record<string, FeatureRule> {
  const out: Record<string, FeatureRule> = {};
  for (const f of FEATURE_CATALOG) {
    const o = overrides[f.key] ?? {};
    out[f.key] = { enabled: o.enabled ?? true, roles: o.roles ?? [], ...(o.actions ? { actions: o.actions } : {}) };
  }
  return out;
}

/**
 * 役割の集合がその機能を使えるか。admin は常に使用可（ロックアウト防止）。
 * 無効化されていれば不可。許可役割が空なら全員可、指定があれば交差が必要。
 */
export function canUseFeature(userRoles: string[], featureKey: string, rules: Record<string, FeatureRule>): boolean {
  if (userRoles.includes("admin")) return true;
  if (!FEATURE_KEYS.has(featureKey)) return false;
  const rule = rules[featureKey] ?? defaultRule();
  if (!rule.enabled) return false;
  if (rule.roles.length === 0) return true;
  return userRoles.some((r) => rule.roles.includes(r));
}

/** 役割が使える機能キーの一覧。 */
export function accessibleFeatures(userRoles: string[], rules: Record<string, FeatureRule>): string[] {
  return FEATURE_CATALOG.filter((f) => canUseFeature(userRoles, f.key, rules)).map((f) => f.key);
}

/**
 * 機能内の特定操作（create/delete/export 等）を実行できるか。
 * まず機能自体が使えること。次にその操作の許可役割が設定されていれば交差が必要（無ければ機能アクセスと同じ）。admin は常に可。
 */
export function canDoAction(userRoles: string[], featureKey: string, action: string, rules: Record<string, FeatureRule>): boolean {
  if (userRoles.includes("admin")) return true;
  if (!canUseFeature(userRoles, featureKey, rules)) return false;
  const actionRoles = rules[featureKey]?.actions?.[action];
  if (!actionRoles || actionRoles.length === 0) return true;
  return userRoles.some((r) => actionRoles.includes(r));
}

// ── ストア（規則の永続化）──

/** 機能アクセス設定ストア。 */
export interface FeatureAccessStore {
  get(): Promise<Record<string, FeatureRule>>;
  update(patch: Record<string, Partial<FeatureRule>>): Promise<Record<string, FeatureRule>>;
}

/** インメモリ実装。 */
export function createMemoryFeatureAccessStore(): FeatureAccessStore {
  let overrides: Record<string, Partial<FeatureRule>> = {};
  return {
    async get() {
      return resolveFeatureRules(overrides);
    },
    async update(patch) {
      overrides = { ...overrides, ...patch };
      return resolveFeatureRules(overrides);
    },
  };
}

// ── Prisma 実装（SettingRow に JSON 保存）──

/** SettingRow の必要部分。 */
export interface FeatureRow {
  key: string;
  value: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface FeatureAccessStoreDb {
  settingRow: {
    findUnique(args: { where: { key: string } }): Promise<FeatureRow | null>;
    upsert(args: { where: { key: string }; create: FeatureRow; update: { value: string } }): Promise<FeatureRow>;
  };
}

const SETTING_KEY = "featureAccess";

/** Prisma 実装（単一 SettingRow に JSON 格納）。 */
export function createPrismaFeatureAccessStore(db: FeatureAccessStoreDb): FeatureAccessStore {
  async function overrides(): Promise<Record<string, Partial<FeatureRule>>> {
    const row = await db.settingRow.findUnique({ where: { key: SETTING_KEY } });
    if (!row) return {};
    try {
      return JSON.parse(row.value) as Record<string, Partial<FeatureRule>>;
    } catch {
      return {};
    }
  }
  return {
    async get() {
      return resolveFeatureRules(await overrides());
    },
    async update(patch) {
      const merged = { ...(await overrides()), ...patch };
      const value = JSON.stringify(merged);
      await db.settingRow.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value }, update: { value } });
      return resolveFeatureRules(merged);
    },
  };
}
