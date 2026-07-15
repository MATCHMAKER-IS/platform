/**
 * レポートのスケジュール配信。定型レポートを頻度（毎日/毎週/毎月）で生成し、宛先（メール/受信箱）へ配信する。純ロジック＋ストア。
 * @packageDocumentation
 */

/** 配信対象のレポート種別。 */
export type ReportType = "sales" | "receivables" | "inventory";

/** 配信頻度。 */
export type ReportFrequency = "daily" | "weekly" | "monthly";

/** レポート配信スケジュール。 */
export interface ReportSchedule {
  id: string;
  reportType: ReportType;
  frequency: ReportFrequency;
  recipient: string;
  enabled: boolean;
  lastSentAt?: string;
}

const DAY = 24 * 60 * 60 * 1000;

/** 配信時期に来ているか（有効かつ前回から間隔超過）。 */
export function isReportDue(schedule: ReportSchedule, now: Date): boolean {
  if (!schedule.enabled) return false;
  if (!schedule.lastSentAt) return true;
  const elapsed = now.getTime() - new Date(schedule.lastSentAt).getTime();
  const interval = schedule.frequency === "daily" ? DAY : schedule.frequency === "weekly" ? 7 * DAY : 30 * DAY;
  return elapsed >= interval;
}

/** 配信すべきスケジュールを選ぶ。 */
export function dueReports(schedules: ReportSchedule[], now: Date): ReportSchedule[] {
  return schedules.filter((s) => isReportDue(s, now));
}

const LABEL: Record<ReportType, string> = { sales: "売上レポート", receivables: "売掛レポート", inventory: "在庫レポート" };

/** 配信メッセージ（件名・本文）を組み立てる。 */
export function buildReportMessage(reportType: ReportType, now: Date, summary: string): { subject: string; body: string } {
  const date = now.toISOString().slice(0, 10);
  return {
    subject: `[定期レポート] ${LABEL[reportType]}（${date}）`,
    body: `${LABEL[reportType]}（${date} 時点）\n\n${summary}\n\n詳細はレポート画面（/reports）でご確認ください。`,
  };
}

/** レポート種別の表示名。 */
export function reportLabel(reportType: ReportType): string {
  return LABEL[reportType];
}

/** スケジュールストア。 */
export interface ReportScheduleStore {
  list(): Promise<ReportSchedule[]>;
  add(reportType: ReportType, frequency: ReportFrequency, recipient: string): Promise<ReportSchedule>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
  markSent(id: string, at: string): Promise<void>;
  remove(id: string): Promise<void>;
}

/** インメモリ実装。 */
export function createMemoryReportScheduleStore(): ReportScheduleStore {
  const items: ReportSchedule[] = [];
  let seq = 0;
  return {
    async list() {
      return items.map((s) => ({ ...s }));
    },
    async add(reportType, frequency, recipient) {
      const s: ReportSchedule = { id: `rs${seq++}`, reportType, frequency, recipient, enabled: true };
      items.push(s);
      return { ...s };
    },
    async setEnabled(id, enabled) {
      const s = items.find((x) => x.id === id);
      if (s) s.enabled = enabled;
    },
    async markSent(id, at) {
      const s = items.find((x) => x.id === id);
      if (s) s.lastSentAt = at;
    },
    async remove(id) {
      const i = items.findIndex((x) => x.id === id);
      if (i >= 0) items.splice(i, 1);
    },
  };
}

// ── Prisma 実装 ──

/** ReportScheduleRow の必要部分。 */
export interface ReportScheduleRow {
  id: string;
  reportType: string;
  frequency: string;
  recipient: string;
  enabled: boolean;
  lastSentAt: string | null;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface ReportScheduleStoreDb {
  reportScheduleRow: {
    findMany(args: { orderBy: { reportType: "asc" } }): Promise<ReportScheduleRow[]>;
    create(args: { data: { reportType: string; frequency: string; recipient: string; enabled: boolean; lastSentAt: string | null } }): Promise<ReportScheduleRow>;
    update(args: { where: { id: string }; data: Partial<{ enabled: boolean; lastSentAt: string }> }): Promise<ReportScheduleRow>;
    delete(args: { where: { id: string } }): Promise<ReportScheduleRow>;
  };
}

const row = (r: ReportScheduleRow): ReportSchedule => ({ id: r.id, reportType: r.reportType as ReportType, frequency: r.frequency as ReportFrequency, recipient: r.recipient, enabled: r.enabled, ...(r.lastSentAt ? { lastSentAt: r.lastSentAt } : {}) });

/** Prisma 実装。 */
export function createPrismaReportScheduleStore(db: ReportScheduleStoreDb): ReportScheduleStore {
  return {
    async list() {
      return (await db.reportScheduleRow.findMany({ orderBy: { reportType: "asc" } })).map(row);
    },
    async add(reportType, frequency, recipient) {
      return row(await db.reportScheduleRow.create({ data: { reportType, frequency, recipient, enabled: true, lastSentAt: null } }));
    },
    async setEnabled(id, enabled) {
      await db.reportScheduleRow.update({ where: { id }, data: { enabled } });
    },
    async markSent(id, at) {
      await db.reportScheduleRow.update({ where: { id }, data: { lastSentAt: at } });
    },
    async remove(id) {
      await db.reportScheduleRow.delete({ where: { id } });
    },
  };
}

// ── 配信先の解決（複数メール / ロール指定）──

/** 配信先文字列を実際のメール一覧に解決する。カンマ/空白区切り、`role:管理者` はそのロールの利用者に展開。重複排除。 */
export function resolveRecipients(recipient: string, users: { email: string; roles: string[] }[]): string[] {
  const out = new Set<string>();
  for (const part of recipient.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)) {
    if (part.startsWith("role:")) {
      const role = part.slice(5);
      for (const u of users) if (u.roles.includes(role)) out.add(u.email);
    } else {
      out.add(part);
    }
  }
  return [...out];
}
