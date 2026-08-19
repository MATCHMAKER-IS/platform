/**
 * 監査ログの記録・検索・改ざん検証。@platform/audit のハッシュチェーンに委譲する。
 * 追記のみ。検証結果（valid/brokenAt）とフィルタ済み一覧を返す。
 * @packageDocumentation
 */
import { formatNumber } from "@platform/utils";
import { AppError, ErrorCode } from "@platform/core";
import { createHash } from "node:crypto";
import { appendEvent, verifyChain, filterByActor, filterByAction, filterByTarget, filterByPeriod, historyOf, describeEvent, deepDiffChanges, type AuditEvent, type AuditEntry, type ChainVerification, type FieldChange } from "@platform/audit";
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
/**
 * 監査ログのハッシュ関数。
 *
 * **既定の FNV-1a(32bit)は改ざん検知に使わない。** 出力が約 43 億通りしかなく、
 * **誕生日攻撃なら約 6.5 万回**で衝突が見つかる——「金額 10000 を 100000 に
 * 書き換えてハッシュを合わせる」が現実的な計算量になる。
 * `@platform/audit` の TSDoc も「運用では sha256 を注入推奨」と書いている(2026-08)。
 */
function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function createAuditLog(store: AuditStore): AuditLog {
  return {
    async record(event) {
      const prev = await store.last();
      const next = appendEvent(prev ? [prev] : [], event, sha256Hex);
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
      // **記録と同じハッシュ関数を使う。** 違うと全件が改ざん扱いになる
      return verifyChain(await store.all(), sha256Hex);
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
      // **`deepDiffChanges` は伏せる仕組みを持たない。** 記録するときに
      // 秘密を除いてあることが前提——ここで初めて伏せることはできない。
      // パスワードやトークンを含む変更を記録するなら、**保存する側で
      // `diffChanges(..., { redact: [...] })` を通すこと**(2026-08 に明記)
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
    findMany(args: { orderBy: { seq: "asc" }; take: number }): Promise<AuditEntryRow[]>;
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
/**
 * `all()` が一度に返す上限。
 *
 * **監査ログは増え続ける**ので、無制限だといつか必ず重くなる。
 * 10 万件は「1 日 300 件で 1 年分」の目安。
 *
 * 【超えたらどうするか】
 * 1. `/admin/data` で**書庫(JSON)を作る**——`buildAuditArchive` が
 *    チェックサム付きで固める
 * 2. **保存義務期間を過ぎた分を DB から消す**(法人税法で原則 7 年。
 *    `@platform/dencho` の `isWithinRetention` で判定できる)
 *
 * **書庫を作っても元は消えない。** 2 の削除は**まだ手段が無く**、
 * SQL で直接消すことになる——**消す前に書庫の検証**
 * (`archiveChecksum`)を必ず通すこと。
 *
 * **消してよいかの判断は `docs/adr/0018-data-retention.md` にある**
 * ——保存義務と削除要求が衝突したら**保存義務を優先する**と決めてある。
 * 「本人から消してと言われた」だけでは消せない。
 */
const AUDIT_ALL_LIMIT = 100_000;

export function createPrismaAuditStore(db: AuditStoreDb): AuditStore {
  return {
    async all() {
      // **上限を設ける。** 監査ログは**増え続ける**——1 年で数十万行になりうる。
      // 2026-08 まで無制限で、`query()` が**毎回全件を読み込んでメモリでフィルタ**
      // していた。**画面が重くなるだけでなく、メモリも食う**。
      //
      // **超えたら知らせる**(黙って切ると「これで全部」と思われる)——
      // `freee` の `fetchAllPages` と同じ判断。
      // 検証(`verifyChain`)は全件が要るので、**上限に達したら検証できない**
      // ことも伝わるようにしてある。
      const rows = await db.auditEntryRow.findMany({ orderBy: { seq: "asc" }, take: AUDIT_ALL_LIMIT + 1 });
      if (rows.length > AUDIT_ALL_LIMIT) {
        throw new AppError(
          ErrorCode.VALIDATION,
          `監査ログが ${formatNumber(AUDIT_ALL_LIMIT)} 件を超えました。` +
          `検索は期間で絞ってください。減らすには ①/admin/data で書庫(JSON)を作る ` +
          `②保存義務期間(法人税法で原則 7 年)を過ぎた分を DB から消す、の順で行います` +
          `——**書庫を作っても元は消えません**`,
          { details: { limit: AUDIT_ALL_LIMIT } },
        );
      }
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
