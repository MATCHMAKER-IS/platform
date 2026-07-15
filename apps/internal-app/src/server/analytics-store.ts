/**
 * アクセス解析の記録・集計サービス。@platform/analytics の純ロジックに委譲。
 * 既定インメモリ、本番は Prisma に差し替え可能。
 * @packageDocumentation
 */
import { summarize, timeSeries, withinPeriod, type AnalyticsEvent, type AnalyticsSummary, type TimePoint, type Bucket } from "@platform/analytics";

/** 記録の入力（at は省略時サーバ時刻）。 */
export interface TrackInput {
  type: AnalyticsEvent["type"];
  path: string;
  sessionId: string;
  userId?: string;
  referrer?: string;
  name?: string;
  at?: string;
}

/** 集計の絞り込み。 */
export interface AnalyticsRange {
  from?: string;
  to?: string;
}

/** アクセス解析サービス。 */
export interface Analytics {
  /** イベントを記録する。 */
  track(input: TrackInput): Promise<void>;
  /** 概況サマリー。 */
  summary(range?: AnalyticsRange, topN?: number): Promise<AnalyticsSummary>;
  /** 時系列。 */
  series(range?: AnalyticsRange, bucket?: Bucket): Promise<TimePoint[]>;
  /** 総イベント数。 */
  size(): Promise<number>;
}

/** イベントストア（差し替え可能）。 */
export interface AnalyticsStore {
  add(event: AnalyticsEvent): Promise<void>;
  all(range?: AnalyticsRange): Promise<AnalyticsEvent[]>;
}

/** インメモリ実装（直近 keep 件を保持）。 */
export function createMemoryAnalyticsStore(options: { keep?: number } = {}): AnalyticsStore {
  const keep = options.keep ?? 100_000;
  let events: AnalyticsEvent[] = [];
  return {
    async add(event) {
      events.push(event);
      if (events.length > keep) events = events.slice(events.length - keep);
    },
    async all(range) {
      return range ? withinPeriod(events, range.from, range.to) : events.slice();
    },
  };
}

/** サービスを作る。 */
export function createAnalytics(store: AnalyticsStore): Analytics {
  return {
    async track(input) {
      const event: AnalyticsEvent = { type: input.type, path: input.path, sessionId: input.sessionId, at: input.at ?? new Date().toISOString() };
      if (input.userId !== undefined) event.userId = input.userId;
      if (input.referrer !== undefined) event.referrer = input.referrer;
      if (input.name !== undefined) event.name = input.name;
      await store.add(event);
    },
    async summary(range, topN) {
      return summarize(await store.all(range), topN !== undefined ? { topN } : {});
    },
    async series(range, bucket) {
      return timeSeries(await store.all(range), bucket);
    },
    async size() {
      return (await store.all()).length;
    },
  };
}

// ── Prisma 実装 ──

/** AnalyticsEventRow の必要部分。 */
export interface AnalyticsEventRow {
  type: string;
  path: string;
  sessionId: string;
  userId: string | null;
  referrer: string | null;
  name: string | null;
  at: Date;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface AnalyticsStoreDb {
  analyticsEventRow: {
    create(args: { data: { type: string; path: string; sessionId: string; userId: string | null; referrer: string | null; name: string | null; at: Date } }): Promise<unknown>;
    findMany(args: { where: { at?: { gte?: Date; lte?: Date } }; orderBy: { at: "asc" } }): Promise<AnalyticsEventRow[]>;
  };
}

function rowToEvent(row: AnalyticsEventRow): AnalyticsEvent {
  const e: AnalyticsEvent = { type: row.type as AnalyticsEvent["type"], path: row.path, sessionId: row.sessionId, at: row.at.toISOString() };
  if (row.userId) e.userId = row.userId;
  if (row.referrer) e.referrer = row.referrer;
  if (row.name) e.name = row.name;
  return e;
}

/** Prisma ストア。 */
export function createPrismaAnalyticsStore(db: AnalyticsStoreDb): AnalyticsStore {
  return {
    async add(event) {
      await db.analyticsEventRow.create({
        data: { type: event.type, path: event.path, sessionId: event.sessionId, userId: event.userId ?? null, referrer: event.referrer ?? null, name: event.name ?? null, at: new Date(event.at) },
      });
    },
    async all(range) {
      const where: { at?: { gte?: Date; lte?: Date } } = {};
      if (range?.from || range?.to) {
        where.at = {};
        if (range.from) where.at.gte = new Date(range.from);
        if (range.to) where.at.lte = new Date(range.to);
      }
      const rows = await db.analyticsEventRow.findMany({ where, orderBy: { at: "asc" } });
      return rows.map(rowToEvent);
    },
  };
}
