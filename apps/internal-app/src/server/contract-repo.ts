/**
 * 契約のデータアクセス。**Prisma 実装とメモリ実装を持つ**。
 *
 * - `CONTRACT_PERSISTENCE=prisma`: DB に保存
 * - それ以外(既定): メモリ + seed(DB 不要ですぐ試せる)
 *
 * ロジック(期限判定・アラート・更新)は `@platform/contract` の担当。
 * @packageDocumentation
 */
import { randomUUID } from "node:crypto";
import type { Contract, RenewalType, ContractStatus } from "@platform/contract";
import { db } from "./services";
import { featureEnv } from "./env";

/** 保存先。 */
export interface ContractStore {
  list(): Promise<Contract[]>;
  get(id: string): Promise<Contract | undefined>;
  create(input: CreateContractInput): Promise<Contract>;
  update(id: string, patch: Partial<Contract>): Promise<Contract | undefined>;
}

/** 新規作成の入力。 */
export interface CreateContractInput {
  title: string;
  partner: string;
  startDate: string;
  endDate: string;
  renewalType?: RenewalType;
  renewalMonths?: number;
  noticeDays?: number;
  amount?: number;
  owner?: string;
}

/** メモリ実装(開発・評価用)。 */
export function createMemoryContractStore(seed: Contract[] = []): ContractStore {
  const items = new Map<string, Contract>(seed.map((c) => [c.id, c]));
  return {
    async list() {
      return [...items.values()];
    },
    async get(id) {
      return items.get(id);
    },
    async create(input) {
      const now = new Date().toISOString();
      const contract: Contract = {
        id: randomUUID(),
        title: input.title,
        partner: input.partner,
        // 新規は draft(いきなり有効にしない。承認を経てから)
        status: "draft",
        startDate: input.startDate,
        endDate: input.endDate,
        renewalType: input.renewalType ?? "manual",
        createdAt: now,
        updatedAt: now,
        ...(input.renewalMonths !== undefined ? { renewalMonths: input.renewalMonths } : {}),
        ...(input.noticeDays !== undefined ? { noticeDays: input.noticeDays } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.owner ? { owner: input.owner } : {}),
      };
      items.set(contract.id, contract);
      return contract;
    },
    async update(id, patch) {
      const cur = items.get(id);
      if (!cur) return undefined;
      const next: Contract = { ...cur, ...patch, id: cur.id, updatedAt: new Date().toISOString() };
      items.set(id, next);
      return next;
    },
  };
}

/** Prisma の Contract 行(生成型の必要部分)。 */
export interface PrismaContractRow {
  id: string;
  title: string;
  partner: string;
  status: string;
  startDate: Date;
  endDate: Date;
  renewalType: string;
  renewalMonths: number | null;
  noticeDays: number | null;
  amount: number | null;
  owner: string | null;
  documentRef: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Prisma 行 → アプリの Contract。
 *
 * 日付は**日付のみ**扱うため YYYY-MM-DD に落とす(時刻は契約管理では不要)。
 * DB の null はアプリの undefined にする。
 *
 * @param row Prisma が返す行
 * @returns アプリで扱う {@link Contract}
 */
export function prismaContractToContract(row: PrismaContractRow): Contract {
  return {
    id: row.id,
    title: row.title,
    partner: row.partner,
    status: row.status as ContractStatus,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    renewalType: row.renewalType as RenewalType,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.renewalMonths !== null ? { renewalMonths: row.renewalMonths } : {}),
    ...(row.noticeDays !== null ? { noticeDays: row.noticeDays } : {}),
    ...(row.amount !== null ? { amount: row.amount } : {}),
    ...(row.owner ? { owner: row.owner } : {}),
    ...(row.documentRef ? { documentRef: row.documentRef } : {}),
  };
}

/** Prisma 実装(本番用)。 */
export function createPrismaContractStore(): ContractStore {
  const model = (db as unknown as { contract: {
    findMany(a?: unknown): Promise<PrismaContractRow[]>;
    findUnique(a: unknown): Promise<PrismaContractRow | null>;
    create(a: unknown): Promise<PrismaContractRow>;
    update(a: unknown): Promise<PrismaContractRow>;
  } }).contract;
  const toDate = (ymd: string): Date => new Date(`${ymd}T00:00:00Z`);

  return {
    async list() {
      return (await model.findMany({ orderBy: { endDate: "asc" } })).map(prismaContractToContract);
    },
    async get(id) {
      const row = await model.findUnique({ where: { id } });
      return row ? prismaContractToContract(row) : undefined;
    },
    async create(input) {
      const row = await model.create({
        data: {
          title: input.title,
          partner: input.partner,
          startDate: toDate(input.startDate),
          endDate: toDate(input.endDate),
          renewalType: input.renewalType ?? "manual",
          renewalMonths: input.renewalMonths ?? null,
          noticeDays: input.noticeDays ?? null,
          amount: input.amount ?? null,
          owner: input.owner ?? null,
        },
      });
      return prismaContractToContract(row);
    },
    async update(id, patch) {
      try {
        const row = await model.update({
          where: { id },
          data: {
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(patch.startDate !== undefined ? { startDate: toDate(patch.startDate) } : {}),
            ...(patch.endDate !== undefined ? { endDate: toDate(patch.endDate) } : {}),
            ...(patch.renewalType !== undefined ? { renewalType: patch.renewalType } : {}),
            ...(patch.renewalMonths !== undefined ? { renewalMonths: patch.renewalMonths ?? null } : {}),
            ...(patch.noticeDays !== undefined ? { noticeDays: patch.noticeDays ?? null } : {}),
            ...(patch.amount !== undefined ? { amount: patch.amount ?? null } : {}),
            ...(patch.owner !== undefined ? { owner: patch.owner ?? null } : {}),
          },
        });
        return prismaContractToContract(row);
      } catch {
        return undefined;
      }
    },
  };
}

/** 動かして確かめられるよう、アラートが出る状態を含めて入れておく。 */
function seedContracts(): Contract[] {
  const now = new Date();
  const day = (offset: number): string => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const base = { createdAt: now.toISOString(), updatedAt: now.toISOString() };
  const mk = (id: string, title: string, partner: string, o: Partial<Contract>): Contract =>
    ({ id, title, partner, status: "active", startDate: day(-365), endDate: day(365), renewalType: "manual", ...base, ...o });

  return [
    // 自動更新・予告期限が迫る(danger。放っておくと 1 年延びる)
    mk("c1", "クラウドストレージ利用契約", "A クラウド", {
      renewalType: "auto", renewalMonths: 12, noticeDays: 60, endDate: day(75), amount: 1_200_000, owner: "情シス",
    }),
    // 自動更新・予告期限を過ぎた(info。もう手遅れ)
    mk("c2", "会計ソフト年間保守", "B ソフト", {
      renewalType: "auto", renewalMonths: 12, noticeDays: 90, endDate: day(60), amount: 480_000, owner: "経理",
    }),
    // 手動更新・終了間近(danger。放置すると切れる)
    mk("c3", "オフィス清掃業務委託", "C サービス", {
      renewalType: "manual", endDate: day(5), amount: 360_000, owner: "総務",
    }),
    // 手動更新・そろそろ(warning)
    mk("c4", "複合機リース", "D リース", {
      renewalType: "manual", endDate: day(25), amount: 240_000, owner: "総務",
    }),
    // 終了日を過ぎて active のまま(データ不整合)
    mk("c5", "旧グループウェア", "E システム", { endDate: day(-30), amount: 600_000, owner: "情シス" }),
    // 余裕あり
    mk("c6", "業務システム開発委託", "F 開発", {
      renewalType: "auto", renewalMonths: 12, noticeDays: 30, endDate: day(300), amount: 8_000_000, owner: "情シス",
    }),
    // 一回限り
    mk("c7", "サーバ移行支援", "F 開発", { renewalType: "none", endDate: day(20), amount: 2_000_000, owner: "情シス" }),
  ];
}

/**
 * アプリで共有するストア。
 * `CONTRACT_PERSISTENCE=prisma` なら DB、それ以外はメモリ(seed 付き)。
 */
export const contractStore: ContractStore = featureEnv.CONTRACT_PERSISTENCE === "prisma"
  ? createPrismaContractStore()
  : createMemoryContractStore(seedContracts());
