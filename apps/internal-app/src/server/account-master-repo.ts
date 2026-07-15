/**
 * 勘定科目マスタ。科目名 → 区分（資産・負債・純資産・収益・費用）の対応を保持し、
 * 手動仕訳など任意科目を損益計算書・貸借対照表に反映できるようにする。
 * @packageDocumentation
 */
import { type AccountTypeMap, type AccountType } from "@platform/accounting";

/** 勘定科目の定義。 */
export interface AccountDef {
  account: string;
  type: AccountType;
}

/** 既定で用意する主な科目（決算整理で使われがちなもの）。 */
export const SEED_ACCOUNTS: AccountDef[] = [
  { account: "前払費用", type: "asset" },
  { account: "未収入金", type: "asset" },
  { account: "前受金", type: "liability" },
  { account: "未払費用", type: "liability" },
  { account: "支払家賃", type: "expense" },
  { account: "水道光熱費", type: "expense" },
  { account: "通信費", type: "expense" },
  { account: "支払手数料", type: "expense" },
  { account: "雑収入", type: "revenue" },
  { account: "受取利息", type: "revenue" },
];

const KNOWN_TYPES: AccountType[] = ["asset", "liability", "equity", "revenue", "expense"];
export function normalizeType(v: string): AccountType | undefined {
  return (KNOWN_TYPES as string[]).includes(v) ? (v as AccountType) : undefined;
}

/** 定義の配列を AccountTypeMap（科目名→区分）に変換する。 */
export function accountTypeMap(defs: AccountDef[]): AccountTypeMap {
  const map: AccountTypeMap = {};
  for (const d of defs) map[d.account] = d.type;
  return map;
}

/** 勘定科目マスタストア。 */
export interface AccountMasterStore {
  list(): Promise<AccountDef[]>;
  upsert(def: AccountDef): Promise<AccountDef>;
  remove(account: string): Promise<void>;
}

/** インメモリ実装（SEED_ACCOUNTS で初期化）。 */
export function createMemoryAccountMasterStore(seed: AccountDef[] = SEED_ACCOUNTS): AccountMasterStore {
  const byName = new Map<string, AccountDef>(seed.map((d) => [d.account, d]));
  return {
    async list() {
      return [...byName.values()].sort((a, b) => (a.account < b.account ? -1 : 1));
    },
    async upsert(def) {
      byName.set(def.account, def);
      return def;
    },
    async remove(account) {
      byName.delete(account);
    },
  };
}

// ── Prisma 実装 ──

/** AccountMasterRow の必要部分。 */
export interface AccountMasterRow {
  account: string;
  type: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface AccountMasterStoreDb {
  accountMasterRow: {
    findMany(args: { orderBy: { account: "asc" } }): Promise<AccountMasterRow[]>;
    upsert(args: { where: { account: string }; create: AccountMasterRow; update: { type: string } }): Promise<AccountMasterRow>;
    delete(args: { where: { account: string } }): Promise<unknown>;
  };
}

/** Prisma 実装。 */
export function createPrismaAccountMasterStore(db: AccountMasterStoreDb): AccountMasterStore {
  return {
    async list() {
      return (await db.accountMasterRow.findMany({ orderBy: { account: "asc" } })).map((r) => ({ account: r.account, type: normalizeType(r.type) ?? "expense" }));
    },
    async upsert(def) {
      await db.accountMasterRow.upsert({ where: { account: def.account }, create: { account: def.account, type: def.type }, update: { type: def.type } });
      return def;
    },
    async remove(account) {
      await db.accountMasterRow.delete({ where: { account } });
    },
  };
}
