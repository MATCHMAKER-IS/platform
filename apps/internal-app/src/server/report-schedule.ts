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

/**
 * 配信時期に来ているか（有効かつ前回から間隔超過）。
 *
 * **月次は「30 日」で数えない。** 2026-08 まで `30 * DAY` としており、
 * 1/31 に送ると次は 3/2 になって**2 月が飛び**、その後も**送信日が毎月ずれて**いった。
 * 月次レポートは経理の締めや役員会に合わせるので、**毎月同じ頃**が期待される。
 *
 * **月が変わったか**で判定する(JST 基準)。日にちの大小は見ないので、
 * 月末に送っていても翌月の初めには「来ている」と判定される
 * ——送り忘れるより、少し早い方がよい。
 */
export function isReportDue(schedule: ReportSchedule, now: Date): boolean {
  if (!schedule.enabled) return false;
  if (!schedule.lastSentAt) return true;
  const last = new Date(schedule.lastSentAt);
  if (schedule.frequency === "monthly") {
    // **JST の年月で比べる。** UTC で見ると月初・月末の深夜に 1 か月ずれる
    const ym = (d: Date): number => {
      const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      return jst.getUTCFullYear() * 12 + jst.getUTCMonth();
    };
    return ym(now) > ym(last);
  }
  const elapsed = now.getTime() - last.getTime();
  const interval = schedule.frequency === "daily" ? DAY : 7 * DAY;
  return elapsed >= interval;
}

/** 配信すべきスケジュールを選ぶ。 */
export function dueReports(schedules: ReportSchedule[], now: Date): ReportSchedule[] {
  return schedules.filter((s) => isReportDue(s, now));
}

const LABEL: Record<ReportType, string> = { sales: "売上レポート", receivables: "売掛レポート", inventory: "在庫レポート" };

/** 配信メッセージ（件名・本文）を組み立てる。 */
export function buildReportMessage(reportType: ReportType, now: Date, summary: string): { subject: string; body: string } {
  // **JST の日付を出す。** `toISOString()` は UTC なので、
  // 早朝の配信では**件名が前日の日付**になる
  // ——「8/10 のレポート」が「8/9」と書かれて届く(2026-08 に修正)
  const date = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
  /** DB では `Date | null`。`ReportSchedule` の公開契約(`lastSentAt?: string`)は
   *  変えない——`row` の境界で変換する(2026-08)。 */
  lastSentAt: Date | null;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface ReportScheduleStoreDb {
  reportScheduleRow: {
    findMany(args: { orderBy: { reportType: "asc" } }): Promise<ReportScheduleRow[]>;
    create(args: { data: { reportType: string; frequency: string; recipient: string; enabled: boolean; lastSentAt: Date | null } }): Promise<ReportScheduleRow>;
    update(args: { where: { id: string }; data: Partial<{ enabled: boolean; lastSentAt: Date }> }): Promise<ReportScheduleRow>;
    delete(args: { where: { id: string } }): Promise<ReportScheduleRow>;
  };
}

const row = (r: ReportScheduleRow): ReportSchedule => ({ id: r.id, reportType: r.reportType as ReportType, frequency: r.frequency as ReportFrequency, recipient: r.recipient, enabled: r.enabled, ...(r.lastSentAt ? { lastSentAt: r.lastSentAt.toISOString() } : {}) });

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
      // **`at` は文字列(公開契約)のまま受け取る。** DB へ書く直前だけ
      // Date に変換する(呼び出し側の report-scan/route.ts に影響を与えない。
      // 2026-08、lastSentAt を DateTime に移行)。
      await db.reportScheduleRow.update({ where: { id }, data: { lastSentAt: new Date(at) } });
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
