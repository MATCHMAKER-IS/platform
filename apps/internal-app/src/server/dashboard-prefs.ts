/**
 * ダッシュボードのウィジェット表示設定（ユーザーごと）。表示するウィジェットのキー集合を保持する。
 * 純粋なマージロジック + ストア（memory / prisma）。
 * @packageDocumentation
 */

/** 利用可能なウィジェットのキー。 */
export const WIDGET_KEYS = ["unread", "pendingApprovals", "myTasks", "recentFiles", "recentNotifications", "recentAudit", "receivables", "inventoryAlerts"] as const;
export type WidgetKey = (typeof WIDGET_KEYS)[number];

/** 既定は全ウィジェット表示。 */
export const DEFAULT_WIDGETS: WidgetKey[] = [...WIDGET_KEYS];

/** ダッシュボード設定。 */
export interface DashboardPreference {
  /** 表示するウィジェット（順序も保持）。 */
  widgets: WidgetKey[];
}

/** 入力を検証し、既知キーのみ・重複排除して正規化する。 */
export function normalizeWidgets(input: unknown): WidgetKey[] {
  if (!Array.isArray(input)) return DEFAULT_WIDGETS;
  const seen = new Set<string>();
  const result: WidgetKey[] = [];
  for (const k of input) {
    if (typeof k === "string" && (WIDGET_KEYS as readonly string[]).includes(k) && !seen.has(k)) {
      seen.add(k);
      result.push(k as WidgetKey);
    }
  }
  return result;
}

/** ウィジェットが表示対象か。 */
export function isWidgetVisible(pref: DashboardPreference, key: WidgetKey): boolean {
  return pref.widgets.includes(key);
}

/** 設定ストア。 */
export interface DashboardPrefStore {
  get(userId: string): Promise<DashboardPreference>;
  set(userId: string, pref: DashboardPreference): Promise<void>;
}

/** インメモリ実装。 */
export function createMemoryDashboardPrefStore(): DashboardPrefStore {
  const byUser = new Map<string, DashboardPreference>();
  return {
    async get(userId) {
      return byUser.get(userId) ?? { widgets: DEFAULT_WIDGETS };
    },
    async set(userId, pref) {
      byUser.set(userId, { widgets: normalizeWidgets(pref.widgets) });
    },
  };
}

// ── Prisma 実装 ──

/** DashboardPrefRow の必要部分。 */
export interface DashboardPrefRow {
  userId: string;
  widgets: unknown;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface DashboardPrefStoreDb {
  dashboardPrefRow: {
    findUnique(args: { where: { userId: string } }): Promise<DashboardPrefRow | null>;
    upsert(args: { where: { userId: string }; create: { userId: string; widgets: unknown }; update: { widgets: unknown } }): Promise<unknown>;
  };
}

/** Prisma ストア。 */
export function createPrismaDashboardPrefStore(db: DashboardPrefStoreDb): DashboardPrefStore {
  return {
    async get(userId) {
      const row = await db.dashboardPrefRow.findUnique({ where: { userId } });
      return { widgets: row ? normalizeWidgets(row.widgets) : DEFAULT_WIDGETS };
    },
    async set(userId, pref) {
      const widgets = normalizeWidgets(pref.widgets);
      await db.dashboardPrefRow.upsert({ where: { userId }, create: { userId, widgets }, update: { widgets } });
    },
  };
}
