/**
 * 取引先マスタ。得意先・仕入先・報酬支払先を一元管理する（1 社が複数区分を持てる）。
 * @packageDocumentation
 */

/** 取引先の区分。 */
export type PartnerKind = "customer" | "supplier" | "payee";

/** 取引先 1 件。 */
export interface Partner {
  code: string;
  name: string;
  kinds: PartnerKind[];
  contact?: string;
  note?: string;
}

const VALID_KINDS: PartnerKind[] = ["customer", "supplier", "payee"];

/** 文字列配列を正規化して有効な区分だけにする（重複除去）。 */
export function normalizeKinds(input: string[]): PartnerKind[] {
  const set = new Set<PartnerKind>();
  for (const k of input) if ((VALID_KINDS as string[]).includes(k)) set.add(k as PartnerKind);
  return VALID_KINDS.filter((k) => set.has(k));
}

/** 区分で絞り込む。 */
export function filterByKind(partners: Partner[], kind: PartnerKind): Partner[] {
  return partners.filter((p) => p.kinds.includes(kind));
}

/** 取引先ストア。 */
export interface PartnerStore {
  list(kind?: PartnerKind): Promise<Partner[]>;
  get(code: string): Promise<Partner | undefined>;
  upsert(partner: Partner): Promise<Partner>;
}

/** インメモリ実装。 */
export function createMemoryPartnerStore(): PartnerStore {
  const byCode = new Map<string, Partner>();
  const order: string[] = [];
  return {
    async list(kind) {
      const all = order.map((c) => byCode.get(c)!);
      return kind ? filterByKind(all, kind) : all;
    },
    async get(code) {
      return byCode.get(code);
    },
    async upsert(partner) {
      const normalized: Partner = { ...partner, kinds: normalizeKinds(partner.kinds) };
      if (!byCode.has(partner.code)) order.push(partner.code);
      byCode.set(partner.code, normalized);
      return normalized;
    },
  };
}

// ── Prisma 実装 ──

/** PartnerRow の必要部分（kinds はカンマ区切り）。 */
export interface PartnerRow {
  code: string;
  name: string;
  kinds: string;
  contact: string | null;
  note: string | null;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface PartnerStoreDb {
  partnerRow: {
    findMany(args: { orderBy: { code: "asc" } }): Promise<PartnerRow[]>;
    findUnique(args: { where: { code: string } }): Promise<PartnerRow | null>;
    upsert(args: { where: { code: string }; create: PartnerRow; update: { name: string; kinds: string; contact: string | null; note: string | null } }): Promise<PartnerRow>;
  };
}

function rowToPartner(row: PartnerRow): Partner {
  const partner: Partner = { code: row.code, name: row.name, kinds: normalizeKinds(row.kinds ? row.kinds.split(",") : []) };
  if (row.contact) partner.contact = row.contact;
  if (row.note) partner.note = row.note;
  return partner;
}

/** Prisma 実装。 */
export function createPrismaPartnerStore(db: PartnerStoreDb): PartnerStore {
  return {
    async list(kind) {
      const all = (await db.partnerRow.findMany({ orderBy: { code: "asc" } })).map(rowToPartner);
      return kind ? filterByKind(all, kind) : all;
    },
    async get(code) {
      const row = await db.partnerRow.findUnique({ where: { code } });
      return row ? rowToPartner(row) : undefined;
    },
    async upsert(partner) {
      const normalized: Partner = { ...partner, kinds: normalizeKinds(partner.kinds) };
      const data: PartnerRow = { code: normalized.code, name: normalized.name, kinds: normalized.kinds.join(","), contact: normalized.contact ?? null, note: normalized.note ?? null };
      await db.partnerRow.upsert({ where: { code: normalized.code }, create: data, update: { name: data.name, kinds: data.kinds, contact: data.contact, note: data.note } });
      return normalized;
    },
  };
}
