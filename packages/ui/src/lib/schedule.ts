/**
 * スケジュール表示の純ロジック(月グリッド生成・時間グリッドのイベント配置・重なり列分割)。
 * UI から分離してテスト可能にする。日付演算は呼び出し側/コンポーネントで @platform/datetime を使う。
 * @packageDocumentation
 */

/** カレンダーに表示するイベント。 */
export interface CalendarEvent {
  id: string;
  /** 開始日時。 */
  start: Date;
  /** 終了日時。 */
  end: Date;
  title: string;
  /** 終日イベント。 */
  allDay?: boolean;
  /** 表示色(帯・チップ)。 */
  color?: string;
  /** カテゴリ(凡例・フィルタ用)。 */
  category?: string;
  /** リソース ID(会議室・担当者など。リソース横並び表示で使う)。 */
  resourceId?: string;
  /** 付随データ(クリック時に受け取る)。 */
  data?: unknown;
}

/** 時間グリッド上でのイベント配置(%指定)。 */
export interface PositionedEvent<E extends CalendarEvent = CalendarEvent> {
  event: E;
  /** 上端(その日の 0:00 からの割合 0..1)。 */
  top: number;
  /** 高さ(割合 0..1)。 */
  height: number;
  /** 横方向の列位置(0-based)。 */
  column: number;
  /** その重なりグループの列数。幅 = 1/columns。 */
  columns: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 同じ暦日か(ローカル時間)。 */
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** 日付の 0:00(ローカル)。 */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** イベントが指定日に掛かるか(終日・複数日跨ぎ対応)。 */
export function eventIntersectsDay(event: CalendarEvent, day: Date): boolean {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + DAY_MS;
  return event.start.getTime() < dayEnd && event.end.getTime() > dayStart;
}

/** 指定日に掛かるイベントを開始順で返す(終日→開始時刻昇順)。 */
export function eventsForDay<E extends CalendarEvent>(events: E[], day: Date): E[] {
  return events
    .filter((e) => eventIntersectsDay(e, day))
    .sort((a, b) => {
      if (!!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1;
      const s = a.start.getTime() - b.start.getTime();
      return s !== 0 ? s : b.end.getTime() - a.end.getTime();
    });
}

/**
 * 時間グリッド(1日分)のイベント配置を計算する。
 * 重なるイベントを列(lane)に振り分け、各イベントの top/height(割合)と column/columns を返す。
 * 終日イベントは対象外(別枠で表示)。指定日に掛かる時間指定イベントのみ配置する。
 */
export function layoutDayEvents<E extends CalendarEvent>(events: E[], day: Date): PositionedEvent<E>[] {
  const dayStart = startOfDay(day).getTime();
  const timed = events
    .filter((e) => !e.allDay && eventIntersectsDay(e, day))
    .sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());

  // その日の範囲にクランプした [start,end] 分を算出
  const spans = timed.map((event) => {
    const s = Math.max(event.start.getTime(), dayStart);
    const e = Math.min(event.end.getTime(), dayStart + DAY_MS);
    return { event, s, e: Math.max(e, s + 1) };
  });

  // 貪欲な列割当 + 重なりグループごとの列数算出
  const positioned: PositionedEvent<E>[] = [];
  let i = 0;
  while (i < spans.length) {
    // 連続して重なるグループを取り出す
    const group: typeof spans = [spans[i]!];
    let groupEnd = spans[i]!.e;
    let j = i + 1;
    while (j < spans.length && spans[j]!.s < groupEnd) {
      group.push(spans[j]!);
      groupEnd = Math.max(groupEnd, spans[j]!.e);
      j++;
    }
    // グループ内で lane(列)を貪欲割当
    const laneEnds: number[] = [];
    const cols: number[] = [];
    for (const sp of group) {
      let lane = laneEnds.findIndex((end) => end <= sp.s);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(sp.e); }
      else laneEnds[lane] = sp.e;
      cols.push(lane);
    }
    const columns = laneEnds.length;
    group.forEach((sp, k) => {
      positioned.push({
        event: sp.event,
        top: (sp.s - dayStart) / DAY_MS,
        height: (sp.e - sp.s) / DAY_MS,
        column: cols[k]!,
        columns,
      });
    });
    i = j;
  }
  return positioned;
}

/** 月表示のセル(1日)。 */
export interface MonthCell {
  date: Date;
  /** 表示対象月に属するか(前後月のはみ出しは false)。 */
  inMonth: boolean;
  /** 今日か。 */
  isToday: boolean;
}

/**
 * 月グリッド(週×7日)を生成する。週の開始は weekStartsOn(0=日曜, 1=月曜。既定 0)。
 * 常に前後月を含めて各週 7 日・6 週(42セル)を返すと崩れないため、必要週数だけ返す。
 */
export function buildMonthGrid(month: Date, options?: { weekStartsOn?: 0 | 1; today?: Date }): MonthCell[][] {
  const weekStartsOn = options?.weekStartsOn ?? 0;
  const today = options?.today ?? new Date();
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  // グリッド開始日(first を含む週の先頭)
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const gridStart = new Date(year, m, 1 - offset);

  const last = new Date(year, m + 1, 0);
  const totalDays = offset + last.getDate();
  const weeks = Math.ceil(totalDays / 7);

  const grid: MonthCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: MonthCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + w * 7 + d);
      row.push({ date, inMonth: date.getMonth() === m, isToday: sameDay(date, today) });
    }
    grid.push(row);
  }
  return grid;
}

/** アジェンダ(リスト)表示用: イベントを日ごとにまとめる。 */
export function groupEventsByDay<E extends CalendarEvent>(events: E[]): { date: Date; events: E[] }[] {
  const map = new Map<string, { date: Date; events: E[] }>();
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const e of sorted) {
    // 跨ぎイベントは掛かる各日に載せる
    let cur = startOfDay(e.start);
    const endDay = startOfDay(e.end);
    // 終了が 0:00 ちょうどなら前日までにする
    const endAdj = e.end.getTime() === endDay.getTime() ? new Date(endDay.getTime() - DAY_MS) : endDay;
    while (cur.getTime() <= endAdj.getTime()) {
      const key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
      if (!map.has(key)) map.set(key, { date: new Date(cur), events: [] });
      map.get(key)!.events.push(e);
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
  }
  return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** 分を "H:MM" 表示にする(時間グリッドの軸ラベル用)。 */
export function formatHourLabel(hour: number): string {
  return `${hour}:00`;
}

/** イベントの時刻範囲を "HH:MM–HH:MM" で返す。 */
export function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return "終日";
  const f = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${f(event.start)}–${f(event.end)}`;
}

// ─────────────────────────── 空き/使用時間の計算(予約枠・会議室の空き)───────────────────────────

/** 時間区間。 */
export interface TimeInterval {
  start: Date;
  end: Date;
}

/** 区間を開始順にソートし、重なり/隣接をマージする。 */
export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals]
    .filter((i) => i.end.getTime() > i.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (sorted.length === 0) return [];
  const merged: TimeInterval[] = [{ start: sorted[0]!.start, end: sorted[0]!.end }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]!;
    const cur = sorted[i]!;
    if (cur.start.getTime() <= last.end.getTime()) {
      // 重なり/隣接 → 結合
      if (cur.end.getTime() > last.end.getTime()) last.end = cur.end;
    } else {
      merged.push({ start: cur.start, end: cur.end });
    }
  }
  return merged;
}

/**
 * 指定ウィンドウ内の使用中(busy)区間を、イベントからマージして返す。
 * 終日イベントはウィンドウ全体を占有する扱い(includeAllDay=false で除外可)。
 */
export function computeBusyIntervals(
  events: CalendarEvent[],
  windowStart: Date,
  windowEnd: Date,
  options?: { includeAllDay?: boolean },
): TimeInterval[] {
  const includeAllDay = options?.includeAllDay ?? true;
  const ws = windowStart.getTime();
  const we = windowEnd.getTime();
  const clamped: TimeInterval[] = [];
  for (const e of events) {
    if (e.allDay && !includeAllDay) continue;
    const s = Math.max(e.start.getTime(), ws);
    const en = Math.min(e.end.getTime(), we);
    if (en > s) clamped.push({ start: new Date(s), end: new Date(en) });
  }
  return mergeIntervals(clamped);
}

/**
 * 指定ウィンドウ内の空き(free)区間を返す(busy の隙間)。
 * 会議室・個人の「空いている時間帯」表示に使う。
 */
export function computeFreeSlots(events: CalendarEvent[], windowStart: Date, windowEnd: Date, options?: { includeAllDay?: boolean }): TimeInterval[] {
  const busy = computeBusyIntervals(events, windowStart, windowEnd, options);
  const free: TimeInterval[] = [];
  let cursor = windowStart.getTime();
  const end = windowEnd.getTime();
  for (const b of busy) {
    if (b.start.getTime() > cursor) free.push({ start: new Date(cursor), end: new Date(b.start.getTime()) });
    cursor = Math.max(cursor, b.end.getTime());
  }
  if (cursor < end) free.push({ start: new Date(cursor), end: new Date(end) });
  return free;
}

/**
 * 指定の長さ(分)以上の空き枠だけを返す(予約可能スロットの抽出)。
 * @param stepMin 枠の刻み(分)。指定すると各空き区間を stepMin 間隔の候補開始に分割する。
 */
export function findAvailableSlots(
  events: CalendarEvent[],
  windowStart: Date,
  windowEnd: Date,
  durationMin: number,
  options?: { includeAllDay?: boolean; stepMin?: number },
): TimeInterval[] {
  const durMs = durationMin * 60_000;
  const free = computeFreeSlots(events, windowStart, windowEnd, options);
  const stepMin = options?.stepMin;
  const slots: TimeInterval[] = [];
  for (const f of free) {
    const span = f.end.getTime() - f.start.getTime();
    if (span < durMs) continue;
    if (!stepMin) {
      slots.push({ start: f.start, end: f.end }); // 連続した空き全体
    } else {
      const stepMs = stepMin * 60_000;
      for (let t = f.start.getTime(); t + durMs <= f.end.getTime() + 1; t += stepMs) {
        slots.push({ start: new Date(t), end: new Date(t + durMs) });
      }
    }
  }
  return slots;
}

/** 合計使用時間(分)を返す(稼働率算出などに)。 */
export function totalBusyMinutes(events: CalendarEvent[], windowStart: Date, windowEnd: Date, options?: { includeAllDay?: boolean }): number {
  return computeBusyIntervals(events, windowStart, windowEnd, options)
    .reduce((sum, b) => sum + (b.end.getTime() - b.start.getTime()) / 60_000, 0);
}

/**
 * 指定日における「今」の縦位置(0..1)を返す。現在時刻ライン描画用。
 * その日でない場合や範囲外は null。
 */
export function nowOffset(day: Date, now: Date = new Date()): number | null {
  if (day.getFullYear() !== now.getFullYear() || day.getMonth() !== now.getMonth() || day.getDate() !== now.getDate()) return null;
  return (now.getHours() * 60 + now.getMinutes()) / (24 * 60);
}

// ─────────────────────────── リソース(会議室・担当者)横並び表示 ───────────────────────────

/** リソース(会議室・担当者・設備など)。 */
export interface CalendarResource {
  id: string;
  label: string;
  color?: string;
}

/** 指定リソースに属するイベントだけを返す(resourceId 未設定は対象外)。 */
export function eventsForResource<E extends CalendarEvent>(events: E[], resourceId: string): E[] {
  return events.filter((e) => e.resourceId === resourceId);
}

/**
 * リソース別・指定日の時間グリッド配置をまとめて返す。
 * 各リソース列は独立に重なり列分割される。
 */
export function layoutResourceDay<E extends CalendarEvent>(
  events: E[],
  resources: CalendarResource[],
  day: Date,
): { resource: CalendarResource; positioned: PositionedEvent<E>[]; allDay: E[] }[] {
  return resources.map((resource) => {
    const own = eventsForResource(events, resource.id);
    return {
      resource,
      positioned: layoutDayEvents(own, day),
      allDay: own.filter((e) => e.allDay && eventIntersectsDay(e, day)),
    };
  });
}
