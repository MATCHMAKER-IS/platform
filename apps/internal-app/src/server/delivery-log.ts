/**
 * レポート配信ログ。いつ・誰に・何のレポートを配信したかを記録し、監査・確認に用いる。純ロジック＋ストア。
 * @packageDocumentation
 */

/** 配信ログの 1 件。 */
export interface DeliveryLogEntry {
  id: string;
  at: string;
  reportType: string;
  recipients: string[];
  recipientCount: number;
  status: "sent" | "skipped";
}

/** 配信ログエントリを作る（宛先数を自動算出）。 */
export function makeDeliveryEntry(at: string, reportType: string, recipients: string[]): Omit<DeliveryLogEntry, "id"> {
  return { at, reportType, recipients, recipientCount: recipients.length, status: recipients.length > 0 ? "sent" : "skipped" };
}

/** 配信ログストア。 */
export interface DeliveryLogStore {
  list(limit?: number): Promise<DeliveryLogEntry[]>;
  add(entry: Omit<DeliveryLogEntry, "id">): Promise<DeliveryLogEntry>;
}

/** インメモリ実装。 */
export function createMemoryDeliveryLogStore(): DeliveryLogStore {
  const entries: DeliveryLogEntry[] = [];
  let seq = 0;
  return {
    async list(limit = 50) {
      return entries.slice(0, limit).map((e) => ({ ...e }));
    },
    async add(entry) {
      const e: DeliveryLogEntry = { id: `dl${seq++}`, ...entry };
      entries.unshift(e); // 新しい順
      return { ...e };
    },
  };
}

// ── Prisma 実装 ──

/** DeliveryLogRow の必要部分。 */
export interface DeliveryLogRow {
  id: string;
  at: string;
  reportType: string;
  recipients: string;
  recipientCount: number;
  status: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface DeliveryLogStoreDb {
  deliveryLogRow: {
    findMany(args: { orderBy: { at: "desc" }; take: number }): Promise<DeliveryLogRow[]>;
    create(args: { data: { at: string; reportType: string; recipients: string; recipientCount: number; status: string } }): Promise<DeliveryLogRow>;
  };
}

/** Prisma 実装（宛先は改行区切りで保存）。 */
export function createPrismaDeliveryLogStore(db: DeliveryLogStoreDb): DeliveryLogStore {
  const toEntry = (r: DeliveryLogRow): DeliveryLogEntry => ({ id: r.id, at: r.at, reportType: r.reportType, recipients: r.recipients ? r.recipients.split("\n") : [], recipientCount: r.recipientCount, status: r.status as "sent" | "skipped" });
  return {
    async list(limit = 50) {
      return (await db.deliveryLogRow.findMany({ orderBy: { at: "desc" }, take: limit })).map(toEntry);
    },
    async add(entry) {
      const r = await db.deliveryLogRow.create({ data: { at: entry.at, reportType: entry.reportType, recipients: entry.recipients.join("\n"), recipientCount: entry.recipientCount, status: entry.status } });
      return toEntry(r);
    },
  };
}
