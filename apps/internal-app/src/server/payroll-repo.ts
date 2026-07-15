/**
 * 給与計算リポジトリ。勤怠の月次集計と時給・手当・控除の設定から給与明細を組み立てる。
 * 割増・明細ロジックは @platform/payroll に委譲する。
 * @packageDocumentation
 */
import { calcMonthlyPay, buildPayslip, OVER60_THRESHOLD_MINUTES, type Payslip, type PayBreakdown, type MonthlyAttendance, type PayslipItem } from "@platform/payroll";

/** 従業員ごとの給与設定。 */
export interface WageConfig {
  userId: string;
  hourlyWage: number;
  allowances: PayslipItem[];
  deductions: PayslipItem[];
}

/** 勤怠の月次集計（給与計算の入力）。 */
export interface AttendanceInput {
  totalMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  holidayMinutes: number;
  workedDays: number;
}

/** 給与計算の結果。 */
export interface PayrollResult {
  month: string;
  userId: string;
  hourlyWage: number;
  attendance: MonthlyAttendance;
  breakdown: PayBreakdown;
  payslip: Payslip;
}

/** 勤怠集計を月次の割増計算入力へ変換する（月60時間超の時間外を算出）。 */
function toMonthly(input: AttendanceInput): MonthlyAttendance {
  return {
    totalMinutes: input.totalMinutes,
    overtimeMinutes: input.overtimeMinutes,
    nightMinutes: input.nightMinutes,
    holidayMinutes: input.holidayMinutes,
    over60Minutes: Math.max(0, input.overtimeMinutes - OVER60_THRESHOLD_MINUTES),
    workedDays: input.workedDays,
  };
}

/** 勤怠集計 + 給与設定から給与明細を組み立てる。 */
export function computePayroll(month: string, wage: WageConfig, attendance: AttendanceInput): PayrollResult {
  const monthly = toMonthly(attendance);
  const breakdown = calcMonthlyPay(monthly, wage.hourlyWage);
  const payslip = buildPayslip(breakdown, { allowances: wage.allowances, deductions: wage.deductions });
  return { month, userId: wage.userId, hourlyWage: wage.hourlyWage, attendance: monthly, breakdown, payslip };
}

/** 既定の給与設定（未登録者向けのフォールバック）。 */
export function defaultWage(userId: string): WageConfig {
  return { userId, hourlyWage: 2000, allowances: [], deductions: [] };
}

/** 給与設定ストア。 */
export interface WageStore {
  get(userId: string): Promise<WageConfig | undefined>;
  set(config: WageConfig): Promise<WageConfig>;
  list(): Promise<WageConfig[]>;
}

/** インメモリ実装。 */
export function createMemoryWageStore(): WageStore {
  const byUser = new Map<string, WageConfig>();
  const order: string[] = [];
  return {
    async get(userId) {
      return byUser.get(userId);
    },
    async set(config) {
      byUser.set(config.userId, config);
      if (!order.includes(config.userId)) order.push(config.userId);
      return config;
    },
    async list() {
      return order.map((u) => byUser.get(u)!);
    },
  };
}

// ── Prisma 実装 ──

/** WageRow の必要部分（手当・控除は JSON）。 */
export interface WageRow {
  userId: string;
  hourlyWage: number;
  allowances: unknown;
  deductions: unknown;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface WageStoreDb {
  wageRow: {
    findMany(args: { orderBy: { userId: "asc" } }): Promise<WageRow[]>;
    findUnique(args: { where: { userId: string } }): Promise<WageRow | null>;
    upsert(args: { where: { userId: string }; create: WageRow; update: { hourlyWage: number; allowances: unknown; deductions: unknown } }): Promise<WageRow>;
  };
}

function rowToConfig(row: WageRow): WageConfig {
  return { userId: row.userId, hourlyWage: row.hourlyWage, allowances: Array.isArray(row.allowances) ? (row.allowances as PayslipItem[]) : [], deductions: Array.isArray(row.deductions) ? (row.deductions as PayslipItem[]) : [] };
}

/** Prisma 実装。 */
export function createPrismaWageStore(db: WageStoreDb): WageStore {
  return {
    async get(userId) {
      const row = await db.wageRow.findUnique({ where: { userId } });
      return row ? rowToConfig(row) : undefined;
    },
    async set(config) {
      await db.wageRow.upsert({ where: { userId: config.userId }, create: { userId: config.userId, hourlyWage: config.hourlyWage, allowances: config.allowances, deductions: config.deductions }, update: { hourlyWage: config.hourlyWage, allowances: config.allowances, deductions: config.deductions } });
      return config;
    },
    async list() {
      return (await db.wageRow.findMany({ orderBy: { userId: "asc" } })).map(rowToConfig);
    },
  };
}
