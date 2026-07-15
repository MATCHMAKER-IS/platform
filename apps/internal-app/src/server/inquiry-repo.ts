/**
 * お問い合わせ（インクワイアリ）リポジトリ。フォームから届いた問い合わせを保持し、対応状況を管理する。
 * @packageDocumentation
 */

/** 対応状況。 */
export type InquiryStatus = "new" | "in_progress" | "closed";

/** お問い合わせ。 */
export interface Inquiry {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: InquiryStatus;
  createdAt: string;
}

/** 新規登録の入力（id・status・createdAt はストアが付与）。 */
export interface InquiryInput {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
}

const KNOWN: InquiryStatus[] = ["new", "in_progress", "closed"];
export function normalizeStatus(v: string): InquiryStatus {
  return (KNOWN as string[]).includes(v) ? (v as InquiryStatus) : "new";
}

/** お問い合わせストア。 */
export interface InquiryStore {
  list(status?: InquiryStatus): Promise<Inquiry[]>;
  get(id: string): Promise<Inquiry | undefined>;
  submit(input: InquiryInput): Promise<Inquiry>;
  setStatus(id: string, status: InquiryStatus): Promise<void>;
  openCount(): Promise<number>;
}

let memSeq = 0;

/** インメモリ実装。 */
export function createMemoryInquiryStore(): InquiryStore {
  const items: Inquiry[] = [];
  return {
    async list(status) {
      return items.filter((i) => status === undefined || i.status === status).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((i) => ({ ...i }));
    },
    async get(id) {
      const it = items.find((i) => i.id === id);
      return it ? { ...it } : undefined;
    },
    async submit(input) {
      const inquiry: Inquiry = { id: `q${memSeq++}`, ...input, status: "new", createdAt: new Date().toISOString() };
      items.push(inquiry);
      return { ...inquiry };
    },
    async setStatus(id, status) {
      const it = items.find((i) => i.id === id);
      if (it) it.status = status;
    },
    async openCount() {
      return items.filter((i) => i.status !== "closed").length;
    },
  };
}

// ── Prisma 実装 ──

/** InquiryRow の必要部分。 */
export interface InquiryRow {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface InquiryStoreDb {
  inquiryRow: {
    findMany(args: { where?: { status: string }; orderBy: { createdAt: "desc" } }): Promise<InquiryRow[]>;
    findUnique(args: { where: { id: string } }): Promise<InquiryRow | null>;
    create(args: { data: { name: string; email: string; category: string; subject: string; message: string; status: string; createdAt: string } }): Promise<InquiryRow>;
    update(args: { where: { id: string }; data: { status: string } }): Promise<InquiryRow>;
    count(args: { where: { status: { not: string } } }): Promise<number>;
  };
}

function rowToInquiry(row: InquiryRow): Inquiry {
  return { id: row.id, name: row.name, email: row.email, category: row.category, subject: row.subject, message: row.message, status: normalizeStatus(row.status), createdAt: row.createdAt };
}

/** Prisma 実装。 */
export function createPrismaInquiryStore(db: InquiryStoreDb): InquiryStore {
  return {
    async list(status) {
      return (await db.inquiryRow.findMany({ ...(status ? { where: { status } } : {}), orderBy: { createdAt: "desc" } })).map(rowToInquiry);
    },
    async get(id) {
      const row = await db.inquiryRow.findUnique({ where: { id } });
      return row ? rowToInquiry(row) : undefined;
    },
    async submit(input) {
      const createdAt = new Date().toISOString();
      const row = await db.inquiryRow.create({ data: { ...input, status: "new", createdAt } });
      return rowToInquiry(row);
    },
    async setStatus(id, status) {
      await db.inquiryRow.update({ where: { id }, data: { status } });
    },
    async openCount() {
      return db.inquiryRow.count({ where: { status: { not: "closed" } } });
    },
  };
}
