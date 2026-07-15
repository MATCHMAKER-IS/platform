/**
 * メールボックス（受信箱）。送信されたメールを宛先ごとに保存し、アプリ内で受信箱として閲覧できるようにする。
 * @platform/mail の Transport 実装 {@link createMailboxTransport} を通じて、アラートメールや内部連絡がここに届く。
 * @packageDocumentation
 */
import { type MailMessage, type MailTransport } from "@platform/mail";

/** 受信箱の 1 通。 */
export interface MailboxMessage {
  id: string;
  /** 所有者（受信者のメールアドレス）。 */
  owner: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  read: boolean;
}

const toList = (to: string | string[]): string[] => (Array.isArray(to) ? to : [to]);

/** メールボックスストア。 */
export interface MailboxStore {
  list(owner: string): Promise<MailboxMessage[]>;
  get(id: string): Promise<MailboxMessage | undefined>;
  deliver(message: { to: string | string[]; from: string; subject: string; body: string; sentAt?: string }): Promise<void>;
  markRead(id: string): Promise<void>;
  unreadCount(owner: string): Promise<number>;
}

let memSeq = 0;

/** インメモリ実装。 */
export function createMemoryMailboxStore(): MailboxStore {
  const messages: MailboxMessage[] = [];
  return {
    async list(owner) {
      return messages.filter((m) => m.owner === owner).sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
    },
    async get(id) {
      return messages.find((m) => m.id === id);
    },
    async deliver(message) {
      const sentAt = message.sentAt ?? new Date().toISOString();
      for (const owner of toList(message.to)) {
        messages.push({ id: `m${memSeq++}`, owner, from: message.from, to: toList(message.to).join(", "), subject: message.subject, body: message.body, sentAt, read: false });
      }
    },
    async markRead(id) {
      const m = messages.find((x) => x.id === id);
      if (m) m.read = true;
    },
    async unreadCount(owner) {
      return messages.filter((m) => m.owner === owner && !m.read).length;
    },
  };
}

/**
 * メールボックスへ配送する Transport を作る。{@link @platform/mail#createMailer} に渡すと、
 * 送信したメールが宛先ごとの受信箱に保存される（実際の外部送信はしない）。
 */
export function createMailboxTransport(store: MailboxStore): MailTransport {
  return {
    async send(message: Required<Pick<MailMessage, "from">> & MailMessage) {
      await store.deliver({ to: message.to, from: message.from, subject: message.subject, body: message.text ?? message.html ?? "", sentAt: new Date().toISOString() });
    },
  };
}

// ── Prisma 実装 ──

/** MailboxRow の必要部分。 */
export interface MailboxRow {
  id: string;
  owner: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  read: boolean;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface MailboxStoreDb {
  mailboxRow: {
    findMany(args: { where: { owner: string; read?: boolean }; orderBy: { sentAt: "desc" } }): Promise<MailboxRow[]>;
    findUnique(args: { where: { id: string } }): Promise<MailboxRow | null>;
    create(args: { data: { owner: string; from: string; to: string; subject: string; body: string; sentAt: string; read: boolean } }): Promise<MailboxRow>;
    update(args: { where: { id: string }; data: { read: boolean } }): Promise<MailboxRow>;
    count(args: { where: { owner: string; read: boolean } }): Promise<number>;
  };
}

function rowToMessage(row: MailboxRow): MailboxMessage {
  return { id: row.id, owner: row.owner, from: row.from, to: row.to, subject: row.subject, body: row.body, sentAt: row.sentAt, read: row.read };
}

/** Prisma 実装。 */
export function createPrismaMailboxStore(db: MailboxStoreDb): MailboxStore {
  return {
    async list(owner) {
      return (await db.mailboxRow.findMany({ where: { owner }, orderBy: { sentAt: "desc" } })).map(rowToMessage);
    },
    async get(id) {
      const row = await db.mailboxRow.findUnique({ where: { id } });
      return row ? rowToMessage(row) : undefined;
    },
    async deliver(message) {
      const sentAt = message.sentAt ?? new Date().toISOString();
      const to = toList(message.to).join(", ");
      for (const owner of toList(message.to)) {
        await db.mailboxRow.create({ data: { owner, from: message.from, to, subject: message.subject, body: message.body, sentAt, read: false } });
      }
    },
    async markRead(id) {
      await db.mailboxRow.update({ where: { id }, data: { read: true } });
    },
    async unreadCount(owner) {
      return db.mailboxRow.count({ where: { owner, read: false } });
    },
  };
}
