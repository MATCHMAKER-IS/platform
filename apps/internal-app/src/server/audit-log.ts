/**
 * 監査ログの記録・検索・改ざん検証。@platform/audit のハッシュチェーンに委譲する。
 * 追記のみ。検証結果（valid/brokenAt）とフィルタ済み一覧を返す。
 * @packageDocumentation
 */
import { appendEvent, verifyChain, filterByActor, filterByAction, filterByTarget, filterByPeriod, historyOf, describeEvent, diffChanges, deepDiffChanges, type AuditEvent, type AuditEntry, type ChainVerification, type FieldChange } from "@platform/audit";
import { toCsv } from "@platform/csv";

/** 検索条件。 */
export interface AuditQuery {
  actor?: string;
  action?: string;
  target?: string;
  from?: string;
  to?: string;
  limit?: number;
}

/** 一覧の 1 行（説明文つき）。 */
export interface AuditRow extends AuditEntry {
  description: string;
}

/** 関連エントリの参照（同じ対象の他の操作）。 */
export interface RelatedEntry {
  seq: number;
  at: string;
  actor: string;
  action: string;
  description: string;
}

/** エントリ詳細（説明 + before/after のネスト差分 + 同一対象の関連エントリ）。 */
export interface AuditEntryDetail extends AuditRow {
  /** ネストしたパス単位の差分（例 "address.city"）。 */
  changes: FieldChange[];
  /** 同じ対象（target）の他のエントリ（自分を除く・古い順）。 */
  related: RelatedEntry[];
}

/** 監査ログサービス。 */
export interface AuditLog {
  /** イベントを記録する（チェーンに追記）。 */
  record(event: AuditEvent): Promise<AuditEntry>;
  /** 条件で検索する（新しい順）。 */
  query(query?: AuditQuery): Promise<AuditRow[]>;
  /** 対象の履歴（古い順）。 */
  history(target: string): Promise<AuditRow[]>;
  /** チェーン全体の改ざん検証。 */
  verify(): Promise<ChainVerification>;
  /** 現在のエントリ数。 */
  size(): Promise<number>;
  /** 検索結果を CSV 文字列にする（Excel 向け BOM 付き）。 */
  exportCsv(query?: AuditQuery): Promise<string>;
  /** 特定エントリ（seq）を before/after 差分つきで取得。無ければ undefined。 */
  entry(seq: number): Promise<AuditEntryDetail | undefined>;
}

/** 追記ストア。 */
export interface AuditStore {
  /** 全エントリ(seq 昇順)。query / verify / history / CSV で使う。 */
  all(): Promise<AuditEntry[]>;
  /** 末尾エントリ(なければ undefined)。record の prevHash 計算に使う。 */
  last(): Promise<AuditEntry | undefined>;
  /** 1 エントリを追記する。 */
  append(entry: AuditEntry): Promise<void>;
  /** 全置換(テスト・改ざん再現用。任意)。 */
  replace?(entries: AuditEntry[]): Promise<void>;
}

/** インメモリ追記ストア。 */
export function createMemoryAuditStore(): AuditStore {
  let entries: AuditEntry[] = [];
  return {
    async all() {
      return entries.slice();
    },
    async last() {
      return entries[entries.length - 1];
    },
    async append(entry) {
      entries.push(entry);
    },
    async replace(next) {
      entries = next;
    },
  };
}

const withDescription = (e: AuditEntry): AuditRow => ({ ...e, description: describeEvent(e) });

/** サービスを作る。 */
export function createAuditLog(store: AuditStore): AuditLog {
  return {
    async record(event) {
      const prev = await store.last();
      const next = appendEvent(prev ? [prev] : [], event);
      const entry = next[next.length - 1]!;
      await store.append(entry);
      return entry;
    },
    async query(query = {}) {
      let log = await store.all();
      if (query.actor) log = filterByActor(log, query.actor);
      if (query.action) log = filterByAction(log, query.action);
      if (query.target) log = filterByTarget(log, query.target);
      if (query.from && query.to) log = filterByPeriod(log, query.from, query.to);
      log = log.slice().sort((a, b) => b.seq - a.seq); // 新しい順
      if (query.limit !== undefined) log = log.slice(0, query.limit);
      return log.map(withDescription);
    },
    async history(target) {
      return historyOf(await store.all(), target).map(withDescription);
    },
    async verify() {
      return verifyChain(await store.all());
    },
    async size() {
      return (await store.all()).length;
    },
    async entry(seq) {
      const log = await store.all();
      const found = log.find((e) => e.seq === seq);
      if (!found) return undefined;
      const related = historyOf(log, found.target)
        .filter((e) => e.seq !== seq)
        .map((e) => ({ seq: e.seq, at: e.at, actor: e.actor, action: e.action, description: describeEvent(e) }));
      return { ...found, description: describeEvent(found), changes: deepDiffChanges(found.before, found.after), related };
    },
    async exportCsv(query = {}) {
      const rows = await this.query(query);
      const records = rows.map((r) => ({
        seq: r.seq,
        at: r.at,
        actor: r.actor,
        action: r.action,
        target: r.target,
        description: r.description,
      }));
      return toCsv(records, {
        bom: true,
        columns: [
          { key: "seq", header: "連番" },
          { key: "at", header: "日時" },
          { key: "actor", header: "操作者" },
          { key: "action", header: "操作" },
          { key: "target", header: "対象" },
          { key: "description", header: "説明" },
        ],
      });
    },
  };
}

// ── Prisma 実装 ──

/** AuditEntryRow(Prisma 生成型の必要部分)。 */
export interface AuditEntryRow {
  seq: number;
  at: Date;
  actor: string;
  action: string;
  target: string;
  before: unknown;
  after: unknown;
  prevHash: string;
  hash: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface AuditStoreDb {
  auditEntryRow: {
    findMany(args: { orderBy: { seq: "asc" } }): Promise<AuditEntryRow[]>;
    findFirst(args: { orderBy: { seq: "desc" } }): Promise<AuditEntryRow | null>;
    create(args: { data: { seq: number; at: Date; actor: string; action: string; target: string; before: unknown; after: unknown; prevHash: string; hash: string } }): Promise<unknown>;
  };
}

function rowToEntry(row: AuditEntryRow): AuditEntry {
  const entry: AuditEntry = {
    seq: row.seq,
    at: row.at.toISOString(),
    actor: row.actor,
    action: row.action,
    target: row.target,
    prevHash: row.prevHash,
    hash: row.hash,
  };
  if (row.before && typeof row.before === "object") entry.before = row.before as Record<string, unknown>;
  if (row.after && typeof row.after === "object") entry.after = row.after as Record<string, unknown>;
  return entry;
}

/** Prisma 追記ストア（チェーンを DB に永続化）。 */
export function createPrismaAuditStore(db: AuditStoreDb): AuditStore {
  return {
    async all() {
      const rows = await db.auditEntryRow.findMany({ orderBy: { seq: "asc" } });
      return rows.map(rowToEntry);
    },
    async last() {
      const row = await db.auditEntryRow.findFirst({ orderBy: { seq: "desc" } });
      return row ? rowToEntry(row) : undefined;
    },
    async append(entry) {
      await db.auditEntryRow.create({
        data: {
          seq: entry.seq,
          at: new Date(entry.at),
          actor: entry.actor,
          action: entry.action,
          target: entry.target,
          before: entry.before ?? null,
          after: entry.after ?? null,
          prevHash: entry.prevHash,
          hash: entry.hash,
        },
      });
    },
  };
}
