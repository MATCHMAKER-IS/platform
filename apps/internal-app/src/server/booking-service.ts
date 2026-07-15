/**
 * 予約サービス。会議室・設備・イベントを**同じ仕組み**で扱う。
 *
 * 「会議室予約」と「イベント予約」は別アプリに見えるが、中身は
 * 「限られた枠を、時間で区切って、誰かが押さえる」で同じ。違いは:
 *   - 会議室・設備: capacity=1(1 枠 1 予約)、繰り返し利用
 *   - イベント: capacity=N(1 枠に N 人)、単発
 * これは `@platform/booking` の capacity で表現できるため、1 つのアプリにまとめている。
 *
 * 永続化は DB(Prisma)。`PERSISTENCE` に依らず、この画面はメモリ実装で動く(デモ用途)。
 * @packageDocumentation
 */
import {
  generateSlots,
  isSlotAvailable,
  countOverlapping,
  hasConflict,
  isWithinBookingWindow,
  canCancel,
  resolveDayHours,
  type Slot,
  type WeeklyHours,
  type BookingInterval,
} from "@platform/booking";
import { AppError, ErrorCode } from "@platform/core";

/** 予約できる対象。 */
export interface Resource {
  id: string;
  name: string;
  /** 種別。表示の出し分けに使う。 */
  kind: "room" | "equipment" | "event";
  /** 同時に受け入れられる数。会議室は 1、イベントは定員。 */
  capacity: number;
  /** 場所・備考。 */
  note?: string;
}

/** 1 件の予約。 */
export interface Booking {
  id: string;
  resourceId: string;
  /** 予約者(メール)。 */
  userId: string;
  /** 用件。 */
  title: string;
  /** ISO 日時。 */
  start: string;
  end: string;
  status: "confirmed" | "cancelled";
  createdAt: string;
}

/** 営業時間(全リソース共通。平日 9:00-18:00、昼休みあり)。 */
const WEEKLY_HOURS: WeeklyHours = {
  1: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "18:00" }],
  2: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "18:00" }],
  3: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "18:00" }],
  4: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "18:00" }],
  5: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "18:00" }],
  0: [],
  6: [],
};

/** 予約のルール。 */
const RULES = {
  /** 1 コマの長さ(分)。 */
  slotMinutes: 30,
  /** 何日先まで予約できるか。 */
  maxDaysAhead: 60,
  /** 何分前まで予約できるか。 */
  minMinutesAhead: 0,
  /** 何分前までキャンセルできるか。 */
  cancelDeadlineMinutes: 60,
};

// デモ用のシード(実運用では DB から読む)
const resources: Resource[] = [
  { id: "room-a", name: "会議室A(8名)", kind: "room", capacity: 1, note: "3F・プロジェクタあり" },
  { id: "room-b", name: "会議室B(4名)", kind: "room", capacity: 1, note: "3F" },
  { id: "car-1", name: "社用車(プリウス)", kind: "equipment", capacity: 1, note: "駐車場A-1" },
  { id: "proj-1", name: "プロジェクタ(貸出)", kind: "equipment", capacity: 1 },
  { id: "seminar-2607", name: "新人研修(7月)", kind: "event", capacity: 20, note: "大会議室・定員20名" },
];

const bookings: Booking[] = [];
let seq = 1;

/** 予約できる対象の一覧。 */
export function listResources(kind?: Resource["kind"]): Resource[] {
  return kind ? resources.filter((r) => r.kind === kind) : [...resources];
}

/** リソース 1 件。 */
export function getResource(id: string): Resource | undefined {
  return resources.find((r) => r.id === id);
}

/** その日の予約一覧(キャンセル済みを除く)。 */
export function listBookings(resourceId: string, date: string): Booking[] {
  return bookings.filter((b) => b.resourceId === resourceId && b.status === "confirmed" && b.start.startsWith(date));
}

/** 自分の予約(新しい順)。 */
export function listMyBookings(userId: string): (Booking & { resourceName: string })[] {
  return bookings
    .filter((b) => b.userId === userId)
    .sort((a, b) => b.start.localeCompare(a.start))
    .map((b) => ({ ...b, resourceName: getResource(b.resourceId)?.name ?? b.resourceId }));
}

/** 予約枠の情報。 */
export interface SlotInfo {
  start: string;
  end: string;
  /** 空いているか。 */
  available: boolean;
  /** 残り枠(イベントで意味を持つ)。 */
  remaining: number;
}

/**
 * その日の空き枠を返す。営業時間からコマを作り、既存の予約と突き合わせる。
 * 休業日(土日)は空配列。
 */
export function getSlots(resourceId: string, date: string): SlotInfo[] {
  const resource = getResource(resourceId);
  if (!resource) throw new AppError(ErrorCode.NOT_FOUND, `対象が見つかりません: ${resourceId}`);

  const hours = resolveDayHours(date, WEEKLY_HOURS);
  if (hours.length === 0) return []; // 休業日

  // 基盤(@platform/booking)は時刻("HH:MM")だけを扱う純ロジック。
  // 日付との組み合わせはアプリ側の責務なので、ここで往復させる。
  const slots: Slot[] = generateSlots(hours, { slotMinutes: RULES.slotMinutes });
  const existing: BookingInterval[] = listBookings(resourceId, date).map((b) => ({
    start: toHHMM(b.start),
    end: toHHMM(b.end),
  }));

  return slots.map((s) => {
    const used = countOverlapping(s, existing);
    return {
      start: toIso(date, s.start),
      end: toIso(date, s.end),
      available: isSlotAvailable(s, existing, resource.capacity),
      remaining: Math.max(0, resource.capacity - used),
    };
  });
}

/** ISO 日時 → "HH:MM"(基盤に渡す形)。 */
function toHHMM(iso: string): string {
  return iso.slice(11, 16);
}

/** 日付 + "HH:MM" → ISO 日時(画面に返す形)。 */
function toIso(date: string, hhmm: string): string {
  return `${date}T${hhmm}:00Z`;
}

/**
 * 予約する。重複・予約可能期間・休業日をすべて検査する。
 * @throws {@link @platform/core#AppError} VALIDATION — ルール違反 / CONFLICT — 埋まっている
 */
export function createBooking(input: { resourceId: string; userId: string; title: string; start: string; end: string }, now = new Date()): Booking {
  const resource = getResource(input.resourceId);
  if (!resource) throw new AppError(ErrorCode.NOT_FOUND, `対象が見つかりません: ${input.resourceId}`);
  if (!input.title.trim()) throw new AppError(ErrorCode.VALIDATION, "用件を入力してください");
  if (input.start >= input.end) throw new AppError(ErrorCode.VALIDATION, "終了は開始より後にしてください");

  // 予約可能期間(何日先まで・何分前まで)
  const window = isWithinBookingWindow(input.start, { maxDaysAhead: RULES.maxDaysAhead, minMinutesAhead: RULES.minMinutesAhead }, now);
  if (!window.ok) throw new AppError(ErrorCode.VALIDATION, window.reason ?? "この日時は予約できません");

  // 休業日
  const date = input.start.slice(0, 10);
  if (resolveDayHours(date, WEEKLY_HOURS).length === 0) {
    throw new AppError(ErrorCode.VALIDATION, "休業日です(土日は予約できません)");
  }

  // 重複(capacity を考慮。会議室は 1 件で埋まる、イベントは定員まで)
  const existing: BookingInterval[] = listBookings(input.resourceId, date).map((b) => ({ start: toHHMM(b.start), end: toHHMM(b.end) }));
  if (hasConflict({ start: toHHMM(input.start), end: toHHMM(input.end) }, existing, resource.capacity)) {
    throw new AppError(ErrorCode.CONFLICT, resource.capacity === 1 ? "その時間は既に予約されています" : "定員に達しています");
  }

  const booking: Booking = {
    id: `bk-${seq++}`,
    resourceId: input.resourceId,
    userId: input.userId,
    title: input.title.trim(),
    start: input.start,
    end: input.end,
    status: "confirmed",
    createdAt: now.toISOString(),
  };
  bookings.push(booking);
  return booking;
}

/**
 * 予約を取り消す。開始直前は取り消せない(RULES.cancelDeadlineMinutes)。
 * 本人以外は取り消せない。
 */
export function cancelBooking(id: string, userId: string, now = new Date()): Booking {
  const booking = bookings.find((b) => b.id === id);
  if (!booking) throw new AppError(ErrorCode.NOT_FOUND, "予約が見つかりません");
  if (booking.userId !== userId) throw new AppError(ErrorCode.FORBIDDEN, "自分の予約のみ取り消せます");
  if (booking.status === "cancelled") throw new AppError(ErrorCode.VALIDATION, "既に取り消されています");
  if (!canCancel(booking.start, RULES.cancelDeadlineMinutes, now)) {
    throw new AppError(ErrorCode.VALIDATION, `開始 ${RULES.cancelDeadlineMinutes} 分前を過ぎたため取り消せません`);
  }
  booking.status = "cancelled";
  return booking;
}

/** テスト用のリセット。 */
export function __reset(): void {
  bookings.length = 0;
  seq = 1;
}
