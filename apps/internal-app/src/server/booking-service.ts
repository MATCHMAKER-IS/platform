/**
 * 予約サービス。会議室・設備・イベントを**同じ仕組み**で扱う。
 *
 * 「会議室予約」と「イベント予約」は別アプリに見えるが、中身は
 * 「限られた枠を、時間で区切って、誰かが押さえる」で同じ。違いは:
 *   - 会議室・設備: capacity=1(1 枠 1 予約)、繰り返し利用
 *   - イベント: capacity=N(1 枠に N 人)、単発
 * これは `@platform/booking` の capacity で表現できるため、1 つのアプリにまとめている。
 *
 * **リソース(会議室名など)はこのファイル内の固定リスト。**
 * 変わらないシードデータなので DB に出す理由が無い。
 *
 * **予約(bookings)は `BookingStore` 経由で永続化する**(2026-08、
 * それまではメモリ配列のみで再起動すると全予約が消えていた)。
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

// リソースは固定のシードデータ(会議室・設備の名前が業務で頻繁に変わることはない)
const resources: Resource[] = [
  { id: "room-a", name: "会議室A(8名)", kind: "room", capacity: 1, note: "3F・プロジェクタあり" },
  { id: "room-b", name: "会議室B(4名)", kind: "room", capacity: 1, note: "3F" },
  { id: "car-1", name: "社用車(プリウス)", kind: "equipment", capacity: 1, note: "駐車場A-1" },
  { id: "proj-1", name: "プロジェクタ(貸出)", kind: "equipment", capacity: 1 },
  { id: "seminar-2607", name: "新人研修(7月)", kind: "event", capacity: 20, note: "大会議室・定員20名" },
];

/** 予約できる対象の一覧。 */
export function listResources(kind?: Resource["kind"]): Resource[] {
  return kind ? resources.filter((r) => r.kind === kind) : [...resources];
}

/** リソース 1 件。 */
export function getResource(id: string): Resource | undefined {
  return resources.find((r) => r.id === id);
}

/** ISO 日時 → "HH:MM"(基盤に渡す形)。 */
function toHHMM(iso: string): string {
  return iso.slice(11, 16);
}

/** 日付 + "HH:MM" → ISO 日時(画面に返す形)。 */
function toIso(date: string, hhmm: string): string {
  return `${date}T${hhmm}:00Z`;
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
 * 予約の永続化ストア。
 *
 * **`createBooking` の実装は「確認してから登録する」処理を、
 * 同時アクセスに対して安全に行う責任を負う。**
 *
 * メモリ実装は Node.js が単一スレッドなので、確認から登録までの間に
 * 他のリクエストが割り込む余地が無く、素朴な実装で安全。
 *
 * **DB 実装はそうはいかない。** `await` を挟んだ瞬間に他のリクエストが
 * 進み、同じ枠を両方が「空いている」と判定しうる——`createPrismaBookingStore`
 * の実装コメントを参照。
 */
export interface BookingStore {
  /** その日の予約一覧(キャンセル済みを除く)。 */
  listBookings(resourceId: string, date: string): Promise<Booking[]>;
  /** 自分の予約(新しい順)。 */
  listMyBookings(userId: string): Promise<(Booking & { resourceName: string })[]>;
  /**
   * これから始まる予約(リソースを問わない。リマインダーの対象探しに使う)。
   *
   * **`within` は上限日数。** 「無期限に全件」を避ける——予約は
   * `maxDaysAhead`(既定 60 日)より先には存在しないので、それより
   * 広く取る理由が無い。
   */
  upcoming(now: Date, withinDays: number): Promise<Booking[]>;
  /**
   * 予約する。重複・予約可能期間・休業日をすべて検査する。
   * @throws {@link @platform/core#AppError} VALIDATION — ルール違反 / CONFLICT — 埋まっている
   */
  createBooking(input: { resourceId: string; userId: string; title: string; start: string; end: string }, now?: Date): Promise<Booking>;
  /**
   * 予約を取り消す。開始直前は取り消せない(RULES.cancelDeadlineMinutes)。
   * 本人以外は取り消せない。
   */
  cancelBooking(id: string, userId: string, now?: Date): Promise<Booking>;
}

/**
 * 検査ロジック(確認)を切り出す。ストア実装から共通で呼ぶ。
 * @throws {@link @platform/core#AppError} 入力・重複エラー
 */
function validateNewBooking(
  input: { resourceId: string; userId: string; title: string; start: string; end: string },
  existing: Booking[],
  now: Date,
): { resource: Resource; date: string } {
  const resource = getResource(input.resourceId);
  if (!resource) throw new AppError(ErrorCode.NOT_FOUND, `対象が見つかりません: ${input.resourceId}`);
  if (!input.title.trim()) throw new AppError(ErrorCode.VALIDATION, "用件を入力してください");
  if (input.start >= input.end) throw new AppError(ErrorCode.VALIDATION, "終了は開始より後にしてください");

  // 予約可能期間(何日先まで・何分前まで)
  // **キー名は `maxAdvanceDays` / `minLeadMinutes`**(BookingWindow)。
  // maxDaysAhead / minMinutesAhead という名前ではない
  const window = isWithinBookingWindow(input.start, { maxAdvanceDays: RULES.maxDaysAhead, minLeadMinutes: RULES.minMinutesAhead }, now);
  if (!window.ok) throw new AppError(ErrorCode.VALIDATION, window.reason ?? "この日時は予約できません");

  // 休業日
  const date = input.start.slice(0, 10);
  if (resolveDayHours(date, WEEKLY_HOURS).length === 0) {
    throw new AppError(ErrorCode.VALIDATION, "休業日です(土日は予約できません)");
  }

  // 重複(capacity を考慮。会議室は 1 件で埋まる、イベントは定員まで)
  const existingIntervals: BookingInterval[] = existing.map((b) => ({ start: toHHMM(b.start), end: toHHMM(b.end) }));
  if (hasConflict({ start: toHHMM(input.start), end: toHHMM(input.end) }, existingIntervals, resource.capacity)) {
    throw new AppError(ErrorCode.CONFLICT, resource.capacity === 1 ? "その時間は既に予約されています" : "定員に達しています");
  }
  return { resource, date };
}

/** インメモリ実装(テスト・デモ用途)。 */
export function createMemoryBookingStore(): BookingStore {
  const bookings: Booking[] = [];
  let seq = 1;

  return {
    async listBookings(resourceId, date) {
      return bookings.filter((b) => b.resourceId === resourceId && b.status === "confirmed" && b.start.startsWith(date));
    },
    async listMyBookings(userId) {
      return bookings
        .filter((b) => b.userId === userId)
        .sort((a, b) => b.start.localeCompare(a.start))
        .map((b) => ({ ...b, resourceName: getResource(b.resourceId)?.name ?? b.resourceId }));
    },
    async upcoming(now, withinDays) {
      const nowMs = now.getTime();
      const untilMs = nowMs + withinDays * 86_400_000;
      return bookings.filter((b) => {
        if (b.status !== "confirmed") return false;
        const startMs = new Date(b.start).getTime();
        return startMs >= nowMs && startMs <= untilMs;
      });
    },
    async createBooking(input, now = new Date()) {
      const date = input.start.slice(0, 10);
      // **今は安全。** Node.js は単一スレッドで、この関数に `await` が
      // 無いので、確認(filter)から登録(push)までの間に他のリクエストが
      // 割り込む余地が無い。DB 実装は同じ前提が成り立たない(下記参照)。
      const existing = bookings.filter((b) => b.resourceId === input.resourceId && b.status === "confirmed" && b.start.startsWith(date));
      validateNewBooking(input, existing, now);
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
    },
    async cancelBooking(id, userId, now = new Date()) {
      const booking = bookings.find((b) => b.id === id);
      if (!booking) throw new AppError(ErrorCode.NOT_FOUND, "予約が見つかりません");
      if (booking.userId !== userId) throw new AppError(ErrorCode.FORBIDDEN, "自分の予約のみ取り消せます");
      if (booking.status === "cancelled") throw new AppError(ErrorCode.VALIDATION, "既に取り消されています");
      if (!canCancel(booking.start, RULES.cancelDeadlineMinutes, now)) {
        throw new AppError(ErrorCode.VALIDATION, `開始 ${RULES.cancelDeadlineMinutes} 分前を過ぎたため取り消せません`);
      }
      booking.status = "cancelled";
      return booking;
    },
  };
}

/** 使用する Prisma デリゲート/クライアントの最小ポート。 */
export interface BookingStoreDb {
  bookingRow: {
    findMany(args: {
      where: { resourceId?: string; userId?: string; status: string; start?: { gte: Date; lt: Date } };
      // **`orderBy` を省略可能にしない。** `check-order-by` に 2 度引っかかった
      // (listBookings と、トランザクション内の再確認)——型で強制すれば、
      // 次に呼び出しを足すときに書き忘れても TypeScript が止めてくれる。
      orderBy: { start: "asc" | "desc" };
      take: number;
    }): Promise<{ id: string; resourceId: string; userId: string; title: string; start: Date; end: Date; status: string; createdAt: Date }[]>;
    create(args: { data: { id: string; resourceId: string; userId: string; title: string; start: Date; end: Date; status: string } }): Promise<unknown>;
    update(args: { where: { id: string }; data: { status: string } }): Promise<unknown>;
    findUnique(args: { where: { id: string } }): Promise<{ id: string; resourceId: string; userId: string; title: string; start: Date; end: Date; status: string; createdAt: Date } | null>;
  };
  /**
   * 行ロックの代わりに使う advisory lock。トランザクションのスコープで
   * 自動解放される(`pg_advisory_xact_lock`)ので、明示的な unlock は要らない。
   */
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  $transaction<T>(fn: (tx: BookingStoreDb) => Promise<T>): Promise<T>;
}

const toRow = (r: { id: string; resourceId: string; userId: string; title: string; start: Date; end: Date; status: string; createdAt: Date }): Booking => ({
  id: r.id, resourceId: r.resourceId, userId: r.userId, title: r.title,
  start: r.start.toISOString(), end: r.end.toISOString(),
  status: r.status as Booking["status"], createdAt: r.createdAt.toISOString(),
});

/**
 * Prisma 実装。
 *
 * **`createBooking` が二重予約を防ぐ仕組み。**
 *
 * 確認(空いているか)と登録(create)の間に `await` を挟むと、その隙間に
 * 別のリクエストが同じ確認を通ってしまう——**2 人が同時に同じ会議室の
 * 同じ時間を予約できる**(2026-08、DB 化する前にこの注意がコードに
 * 残っていたので対応した)。
 *
 * **`pg_advisory_xact_lock` で resourceId ごとに直列化する。**
 * 同じリソースへの予約リクエストは、1 件ずつ順番に処理される
 * (別のリソースへの予約は並行して進む——ロックの粒度はリソース単位)。
 * トランザクションが終わる(commit/rollback)と自動で解放されるので、
 * 明示的なロック解除やタイムアウト処理は要らない。
 *
 * これは「行ロック」の代わりである。**予約という行が作られる前は、
 * ロックする対象の行自体が存在しない**——`SELECT ... FOR UPDATE` は
 * 既存の行にしか効かないので、ここでは「リソース ID」という値そのものに
 * ロックをかける advisory lock を使う。
 */
export function createPrismaBookingStore(db: BookingStoreDb): BookingStore {
  return {
    async listBookings(resourceId, date) {
      const dayStart = new Date(`${date}T00:00:00Z`);
      const dayEnd = new Date(`${date}T23:59:59.999Z`);
      const rows = await db.bookingRow.findMany({
        where: { resourceId, status: "confirmed", start: { gte: dayStart, lt: dayEnd } },
        orderBy: { start: "asc" },
        take: 200,
      });
      return rows.map(toRow);
    },
    async listMyBookings(userId) {
      const rows = await db.bookingRow.findMany({ where: { userId, status: "confirmed" }, orderBy: { start: "desc" }, take: 200 });
      return rows.map((r) => ({ ...toRow(r), resourceName: getResource(r.resourceId)?.name ?? r.resourceId }));
    },
    async upcoming(now, withinDays) {
      const until = new Date(now.getTime() + withinDays * 86_400_000);
      const rows = await db.bookingRow.findMany({
        where: { status: "confirmed", start: { gte: now, lt: until } },
        orderBy: { start: "asc" },
        take: 500,
      });
      return rows.map(toRow);
    },
    async createBooking(input, now = new Date()) {
      return db.$transaction(async (tx) => {
        // **同じリソースへの他の予約試行を待たせる。** ロックはトランザクション
        // 終了まで保持される(このコールバックの return まで)。
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.resourceId}))`;

        const date = input.start.slice(0, 10);
        const dayStart = new Date(`${date}T00:00:00Z`);
        const dayEnd = new Date(`${date}T23:59:59.999Z`);
        const existingRows = await tx.bookingRow.findMany({
          where: { resourceId: input.resourceId, status: "confirmed", start: { gte: dayStart, lt: dayEnd } },
          orderBy: { start: "asc" },
          take: 200,
        });
        const existing = existingRows.map(toRow);

        // **ロックの内側で検査する。** ロックの外で確認すると、確認と
        // ロック取得の間にまた隙間ができる——検査そのものをロックの内側に置く。
        validateNewBooking(input, existing, now);

        const id = `bk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await tx.bookingRow.create({
          data: { id, resourceId: input.resourceId, userId: input.userId, title: input.title.trim(), start: new Date(input.start), end: new Date(input.end), status: "confirmed" },
        });
        return { id, resourceId: input.resourceId, userId: input.userId, title: input.title.trim(), start: input.start, end: input.end, status: "confirmed" as const, createdAt: now.toISOString() };
      });
    },
    async cancelBooking(id, userId, now = new Date()) {
      const row = await db.bookingRow.findUnique({ where: { id } });
      if (!row) throw new AppError(ErrorCode.NOT_FOUND, "予約が見つかりません");
      if (row.userId !== userId) throw new AppError(ErrorCode.FORBIDDEN, "自分の予約のみ取り消せます");
      if (row.status === "cancelled") throw new AppError(ErrorCode.VALIDATION, "既に取り消されています");
      const booking = toRow(row);
      if (!canCancel(booking.start, RULES.cancelDeadlineMinutes, now)) {
        throw new AppError(ErrorCode.VALIDATION, `開始 ${RULES.cancelDeadlineMinutes} 分前を過ぎたため取り消せません`);
      }
      await db.bookingRow.update({ where: { id }, data: { status: "cancelled" } });
      return { ...booking, status: "cancelled" };
    },
  };
}

/**
 * その日の空き枠を返す。営業時間からコマを作り、既存の予約と突き合わせる。
 * 休業日(土日)は空配列。
 */
export async function getSlots(store: BookingStore, resourceId: string, date: string): Promise<SlotInfo[]> {
  const resource = getResource(resourceId);
  if (!resource) throw new AppError(ErrorCode.NOT_FOUND, `対象が見つかりません: ${resourceId}`);

  const hours = resolveDayHours(date, WEEKLY_HOURS);
  if (hours.length === 0) return []; // 休業日

  // 基盤(@platform/booking)は時刻("HH:MM")だけを扱う純ロジック。
  // 日付との組み合わせはアプリ側の責務なので、ここで往復させる。
  const slots: Slot[] = generateSlots(hours, { slotMinutes: RULES.slotMinutes });
  const existingBookings = await store.listBookings(resourceId, date);
  const existing: BookingInterval[] = existingBookings.map((b) => ({ start: toHHMM(b.start), end: toHHMM(b.end) }));

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

/** リマインダー等で使う予約ルール(前日通知の締切判定などに)。 */
export const BOOKING_RULES = RULES;
