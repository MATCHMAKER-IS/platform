/**
 * 公開申請。公開権限を持たない編集者が公開を申請し、承認者が承認/却下する。
 * @packageDocumentation
 */

/** 申請の状態。 */
export type PublishRequestStatus = "pending" | "approved" | "rejected";

/** 公開申請。 */
export interface PublishRequest {
  id: string;
  postSlug: string;
  requestedBy: string;
  requestedAt: string;
  status: PublishRequestStatus;
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
}

/** 公開申請ストア。 */
export interface PublishRequestStore {
  list(options?: { status?: PublishRequestStatus }): Promise<PublishRequest[]>;
  get(id: string): Promise<PublishRequest | undefined>;
  /** 既存の pending があればそれを返し、無ければ新規作成する。 */
  request(postSlug: string, requestedBy: string): Promise<PublishRequest>;
  /** 承認または却下する。 */
  decide(id: string, status: "approved" | "rejected", decidedBy: string, note?: string): Promise<PublishRequest | undefined>;
}

/** インメモリ実装。 */
export function createMemoryPublishRequestStore(genId: () => string = () => `pr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, now: () => string = () => new Date().toISOString()): PublishRequestStore {
  const byId = new Map<string, PublishRequest>();
  const order: string[] = [];
  return {
    async list(options = {}) {
      const all = order.map((id) => byId.get(id)!).filter(Boolean);
      return options.status ? all.filter((r) => r.status === options.status) : all;
    },
    async get(id) {
      return byId.get(id);
    },
    async request(postSlug, requestedBy) {
      const existing = order.map((id) => byId.get(id)!).find((r) => r.postSlug === postSlug && r.status === "pending");
      if (existing) return existing;
      const id = genId();
      const req: PublishRequest = { id, postSlug, requestedBy, requestedAt: now(), status: "pending" };
      byId.set(id, req);
      order.push(id);
      return req;
    },
    async decide(id, status, decidedBy, note) {
      const req = byId.get(id);
      if (!req) return undefined;
      const updated: PublishRequest = { ...req, status, decidedBy, decidedAt: now() };
      if (note !== undefined) updated.note = note;
      byId.set(id, updated);
      return updated;
    },
  };
}

// ── Prisma 実装 ──

/** PublishRequestRow の必要部分。 */
export interface PublishRequestRow {
  id: string;
  postSlug: string;
  requestedBy: string;
  requestedAt: Date;
  status: string;
  decidedBy: string | null;
  decidedAt: Date | null;
  note: string | null;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface PublishRequestStoreDb {
  publishRequestRow: {
    findMany(args: { where?: { status?: string }; orderBy: { requestedAt: "asc" } }): Promise<PublishRequestRow[]>;
    findUnique(args: { where: { id: string } }): Promise<PublishRequestRow | null>;
    findFirst(args: { where: { postSlug: string; status: string } }): Promise<PublishRequestRow | null>;
    create(args: { data: { postSlug: string; requestedBy: string; status: string } }): Promise<PublishRequestRow>;
    update(args: { where: { id: string }; data: { status: string; decidedBy: string; decidedAt: Date; note?: string | null } }): Promise<PublishRequestRow>;
  };
}

function rowToRequest(row: PublishRequestRow): PublishRequest {
  const req: PublishRequest = { id: row.id, postSlug: row.postSlug, requestedBy: row.requestedBy, requestedAt: row.requestedAt.toISOString(), status: row.status === "approved" ? "approved" : row.status === "rejected" ? "rejected" : "pending" };
  if (row.decidedBy) req.decidedBy = row.decidedBy;
  if (row.decidedAt) req.decidedAt = row.decidedAt.toISOString();
  if (row.note) req.note = row.note;
  return req;
}

/** Prisma 実装。 */
export function createPrismaPublishRequestStore(db: PublishRequestStoreDb): PublishRequestStore {
  return {
    async list(options = {}) {
      return (await db.publishRequestRow.findMany({ ...(options.status ? { where: { status: options.status } } : {}), orderBy: { requestedAt: "asc" } })).map(rowToRequest);
    },
    async get(id) {
      const row = await db.publishRequestRow.findUnique({ where: { id } });
      return row ? rowToRequest(row) : undefined;
    },
    async request(postSlug, requestedBy) {
      const existing = await db.publishRequestRow.findFirst({ where: { postSlug, status: "pending" } });
      if (existing) return rowToRequest(existing);
      const row = await db.publishRequestRow.create({ data: { postSlug, requestedBy, status: "pending" } });
      return rowToRequest(row);
    },
    async decide(id, status, decidedBy, note) {
      const existing = await db.publishRequestRow.findUnique({ where: { id } });
      if (!existing) return undefined;
      const row = await db.publishRequestRow.update({ where: { id }, data: { status, decidedBy, decidedAt: new Date(), ...(note !== undefined ? { note } : {}) } });
      return rowToRequest(row);
    },
  };
}
