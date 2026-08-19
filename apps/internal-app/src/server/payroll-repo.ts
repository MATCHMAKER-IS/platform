/**
 * 給与計算リポジトリ。勤怠の月次集計と時給・手当・控除の設定から給与明細を組み立てる。
 * 割増・明細ロジックは @platform/payroll に委譲する。
 * @packageDocumentation
 */
import {
  calcMonthlyPay, buildPayslip, OVER60_THRESHOLD_MINUTES,
  calcInsuranceDeduction, REFERENCE_RATES_2026_TOKYO,
  type Payslip, type PayBreakdown, type MonthlyAttendance, type PayslipItem, type InsuranceDeduction,
} from "@platform/payroll";

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

/**
 * 給与計算に要る個人情報(生年月日・扶養人数)。
 *
 * **未登録なら社会保険料は計算しない**(段階導入)。
 * 「等級表を引けないから概算で埋める」より、**空欄のまま「未計算」と
 * 分かる方が安全**——概算額を本物の控除額と取り違えられると、
 * 実際の手取りと合わない給与明細が確定してしまう。
 */
export interface PayrollProfile {
  userId: string;
  /** 生年月日(YYYY-MM-DD)。 */
  birthDate: string;
  /** 扶養親族等の人数(0〜7)。 */
  dependents: number;
}

/** 給与計算の結果。 */
export interface PayrollResult {
  month: string;
  userId: string;
  hourlyWage: number;
  attendance: MonthlyAttendance;
  breakdown: PayBreakdown;
  payslip: Payslip;
  /**
   * 社会保険料(本人負担分)。
   *
   * **`PayrollProfile` が無ければ `undefined`。** 画面側は「未計算」として
   * 明示的に表示すること——0 円と区別できないと、控除が漏れていることに
   * 誰も気づけない。
   */
  insurance?: InsuranceDeduction;
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

/**
 * 勤怠集計 + 給与設定から給与明細を組み立てる。
 *
 * @param profile 生年月日・扶養人数(社会保険料の計算に要る)。無ければ
 *   `insurance` は `undefined` のまま返す(未計算であることを明示する)。
 */
export function computePayroll(month: string, wage: WageConfig, attendance: AttendanceInput, profile?: PayrollProfile): PayrollResult {
  const monthly = toMonthly(attendance);
  const breakdown = calcMonthlyPay(monthly, wage.hourlyWage);

  let insurance: InsuranceDeduction | undefined;
  let deductions = wage.deductions;
  if (profile) {
    // **標準報酬月額は「総支給」で見る。** 手当を除いた基本給ではなく、
    // 割増・手当込みの額面から等級を引く(等級表の定義どおり)。
    insurance = calcInsuranceDeduction(
      { monthlyPay: breakdown.total, birthDate: profile.birthDate, targetMonth: month },
      REFERENCE_RATES_2026_TOKYO,
    );
    // **明細の「控除」欄に社会保険料を差し込む。** 手当・控除の手入力項目とは別に
    // 自動計算した額を明示し、`(自動計算)` と分かる名前を付ける。
    deductions = [
      ...wage.deductions,
      { name: "健康保険料(自動計算)", amount: insurance.health },
      ...(insurance.longTermCare > 0 ? [{ name: "介護保険料(自動計算)", amount: insurance.longTermCare }] : []),
      { name: "厚生年金保険料(自動計算)", amount: insurance.pension },
      { name: "雇用保険料(自動計算)", amount: insurance.employmentInsurance },
    ];
  }

  const payslip = buildPayslip(breakdown, { allowances: wage.allowances, deductions });
  return { month, userId: wage.userId, hourlyWage: wage.hourlyWage, attendance: monthly, breakdown, payslip, ...(insurance ? { insurance } : {}) };
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

/** 給与プロファイル(生年月日・扶養人数)のストア。 */
export interface PayrollProfileStore {
  get(userId: string): Promise<PayrollProfile | undefined>;
  set(profile: PayrollProfile): Promise<PayrollProfile>;
}

/** インメモリ実装。 */
export function createMemoryPayrollProfileStore(): PayrollProfileStore {
  const byUser = new Map<string, PayrollProfile>();
  return {
    async get(userId) {
      return byUser.get(userId);
    },
    async set(profile) {
      byUser.set(profile.userId, profile);
      return profile;
    },
  };
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface PayrollProfileStoreDb {
  payrollProfileRow: {
    findUnique(args: { where: { userId: string } }): Promise<{ userId: string; birthDate: string; dependents: number } | null>;
    upsert(args: {
      where: { userId: string };
      create: { userId: string; birthDate: string; dependents: number };
      update: { birthDate: string; dependents: number };
    }): Promise<{ userId: string; birthDate: string; dependents: number }>;
  };
}

/** Prisma 実装。 */
export function createPrismaPayrollProfileStore(db: PayrollProfileStoreDb): PayrollProfileStore {
  return {
    async get(userId) {
      const row = await db.payrollProfileRow.findUnique({ where: { userId } });
      return row ? { userId: row.userId, birthDate: row.birthDate, dependents: row.dependents } : undefined;
    },
    async set(profile) {
      await db.payrollProfileRow.upsert({
        where: { userId: profile.userId },
        create: { userId: profile.userId, birthDate: profile.birthDate, dependents: profile.dependents },
        update: { birthDate: profile.birthDate, dependents: profile.dependents },
      });
      return profile;
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
