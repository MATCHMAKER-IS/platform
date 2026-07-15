/**
 * 繰り返し請求（サブスク）リポジトリ。スケジュール判定は @platform/invoice に委譲する。
 * @packageDocumentation
 */
import { buildInvoice, nextBillingDate, dueForBilling, type Invoice, type InvoiceLine, type RecurringSchedule, type BillingInterval } from "@platform/invoice";

/** 繰り返し請求プランの入力。 */
export interface RecurringPlanInput {
  number: string;
  billTo: string;
  interval: BillingInterval;
  startDate: string;
  endDate?: string;
  lines: InvoiceLine[];
}

/** 保存する繰り返し請求プラン。 */
export interface RecurringPlan extends RecurringPlanInput {
  lastBilled?: string;
  active: boolean;
}

/** 一覧・詳細に付ける算出値。 */
export interface RecurringPlanView extends RecurringPlan {
  nextDate: string | null;
  due: boolean;
}

function scheduleOf(plan: RecurringPlan): RecurringSchedule {
  const s: RecurringSchedule = { interval: plan.interval, startDate: plan.startDate };
  if (plan.endDate !== undefined) s.endDate = plan.endDate;
  return s;
}

function toView(plan: RecurringPlan, asOf: Date): RecurringPlanView {
  const schedule = scheduleOf(plan);
  const asOfIso = asOf.toISOString().slice(0, 10);
  return {
    ...plan,
    nextDate: nextBillingDate(schedule, plan.lastBilled ?? plan.startDate),
    due: plan.active && dueForBilling(schedule, asOfIso, plan.lastBilled),
  };
}

/** プランから請求書を組み立てる（番号・発行日・支払期限は呼び出し側が決める）。 */
export function invoiceFromPlan(plan: RecurringPlan, header: { number: string; issueDate: string; dueDate: string; registrationNumber?: string }): Invoice {
  return buildInvoice({ ...header, billTo: plan.billTo }, plan.lines);
}

/** 繰り返し請求ストア。 */
export interface RecurringStore {
  list(asOf?: Date): Promise<RecurringPlanView[]>;
  get(number: string, asOf?: Date): Promise<RecurringPlanView | undefined>;
  create(input: RecurringPlanInput): Promise<RecurringPlan>;
  setActive(number: string, active: boolean): Promise<RecurringPlanView | undefined>;
  markBilled(number: string, date: string): Promise<RecurringPlanView | undefined>;
  /** 課金対象（active かつ due）のプランを返す。 */
  due(asOf?: Date): Promise<RecurringPlanView[]>;
}

/** インメモリ実装。 */
export function createMemoryRecurringStore(): RecurringStore {
  const byNumber = new Map<string, RecurringPlan>();
  const order: string[] = [];
  const store: RecurringStore = {
    async list(asOf = new Date()) {
      return order.map((n) => toView(byNumber.get(n)!, asOf));
    },
    async get(number, asOf = new Date()) {
      const plan = byNumber.get(number);
      return plan ? toView(plan, asOf) : undefined;
    },
    async create(input) {
      const plan: RecurringPlan = { ...input, active: true };
      byNumber.set(input.number, plan);
      if (!order.includes(input.number)) order.push(input.number);
      return plan;
    },
    async setActive(number, active) {
      const plan = byNumber.get(number);
      if (!plan) return undefined;
      plan.active = active;
      return toView(plan, new Date());
    },
    async markBilled(number, date) {
      const plan = byNumber.get(number);
      if (!plan) return undefined;
      plan.lastBilled = date;
      return toView(plan, new Date());
    },
    async due(asOf = new Date()) {
      return (await store.list(asOf)).filter((p) => p.due);
    },
  };
  return store;
}

// ── Prisma 実装 ──

/** RecurringPlanRow の必要部分（明細は JSON）。 */
export interface RecurringPlanRow {
  number: string;
  billTo: string;
  interval: string;
  startDate: string;
  endDate: string | null;
  lines: unknown;
  lastBilled: string | null;
  active: boolean;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface RecurringStoreDb {
  recurringPlanRow: {
    findMany(args: { orderBy: { startDate: "asc" } }): Promise<RecurringPlanRow[]>;
    findUnique(args: { where: { number: string } }): Promise<RecurringPlanRow | null>;
    create(args: { data: RecurringPlanRow }): Promise<RecurringPlanRow>;
    update(args: { where: { number: string }; data: { active?: boolean; lastBilled?: string } }): Promise<RecurringPlanRow>;
  };
}

function normalizeInterval(v: string): BillingInterval {
  return v === "quarterly" || v === "yearly" ? v : "monthly";
}

function rowToPlan(row: RecurringPlanRow): RecurringPlan {
  const plan: RecurringPlan = { number: row.number, billTo: row.billTo, interval: normalizeInterval(row.interval), startDate: row.startDate, lines: Array.isArray(row.lines) ? (row.lines as InvoiceLine[]) : [], active: row.active };
  if (row.endDate) plan.endDate = row.endDate;
  if (row.lastBilled) plan.lastBilled = row.lastBilled;
  return plan;
}

/** Prisma 実装。 */
export function createPrismaRecurringStore(db: RecurringStoreDb): RecurringStore {
  const store: RecurringStore = {
    async list(asOf = new Date()) {
      return (await db.recurringPlanRow.findMany({ orderBy: { startDate: "asc" } })).map((r) => toView(rowToPlan(r), asOf));
    },
    async get(number, asOf = new Date()) {
      const row = await db.recurringPlanRow.findUnique({ where: { number } });
      return row ? toView(rowToPlan(row), asOf) : undefined;
    },
    async create(input) {
      await db.recurringPlanRow.create({ data: { number: input.number, billTo: input.billTo, interval: input.interval, startDate: input.startDate, endDate: input.endDate ?? null, lines: input.lines, lastBilled: null, active: true } });
      return { ...input, active: true };
    },
    async setActive(number, active) {
      const row = await db.recurringPlanRow.findUnique({ where: { number } });
      if (!row) return undefined;
      const updated = await db.recurringPlanRow.update({ where: { number }, data: { active } });
      return toView(rowToPlan(updated), new Date());
    },
    async markBilled(number, date) {
      const row = await db.recurringPlanRow.findUnique({ where: { number } });
      if (!row) return undefined;
      const updated = await db.recurringPlanRow.update({ where: { number }, data: { lastBilled: date } });
      return toView(rowToPlan(updated), new Date());
    },
    async due(asOf = new Date()) {
      return (await store.list(asOf)).filter((p) => p.due);
    },
  };
  return store;
}
