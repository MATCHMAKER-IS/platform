/**
 * キャスト予約サイトの実装例(基盤パッケージの組み合わせ)。
 * cast(一覧/ランキング/プロフィール)+ social(SNS/最新投稿)+ booking(シフト空き枠/予約ルール/
 * リマインダー)+ seo(公開ページのメタ)を束ね、サイトの各画面に必要なデータを組み立てる。
 * ロジックは基盤側にあり、ここは「どう組み合わせるか」を示すアプリ層の薄い配線。
 * @packageDocumentation
 */
import {
  type Cast, type RankedCast,
  featuredCasts, newcomers, tagCounts,
  rankCasts, profileItems, profileCompleteness, type ProfileField,
} from "@platform/cast";
import {
  accountsFromUrls, accountLinks, latestPerPlatform, type SocialPost,
} from "@platform/social";
import {
  generateSlots, staffAvailableSlots, reminderSchedule, isWithinBookingWindow,
  canCancel, BOOKING_STATUS_LABELS, type Shift, type BookingInterval, type TimeRange,
} from "@platform/booking";
import { buildMeta, type MetaResult } from "@platform/seo";

/** トップページのデータ。 */
export interface HomePageData<T extends RankedCast> {
  featured: T[];
  newcomers: T[];
  ranking: { rank: number; cast: T; score: number }[];
  tags: { tag: string; count: number }[];
}

/** トップページ: 注目・新人・口コミランキング・タグ一覧をまとめる。 */
export function buildHomePage<T extends RankedCast>(casts: T[], now?: Date): HomePageData<T> {
  return {
    featured: featuredCasts(casts, 6),
    newcomers: newcomers(casts, 30, now),
    ranking: rankCasts(casts, { minCount: 10, limit: 10 }),
    tags: tagCounts(casts),
  };
}

/** キャスト個別ページのデータ。 */
export interface CastPageData {
  profile: { label: string; value: string }[];
  completeness: number;
  socialLinks: { platform: string; label: string; url: string }[];
  latestPosts: SocialPost[];
  meta: MetaResult;
}

/** キャスト個別ページ: プロフィール + SNS リンク + 各SNS最新投稿 + 公開用メタ。 */
export function buildCastPage(
  cast: Cast,
  input: { socialUrls: string[]; posts: SocialPost[]; fields: ProfileField[]; baseUrl: string },
): CastPageData {
  const accounts = accountsFromUrls(input.socialUrls);
  const bio = typeof cast.bio === "string" ? cast.bio : `${cast.name}のプロフィール`;
  return {
    profile: profileItems(cast, input.fields),
    completeness: profileCompleteness(cast, input.fields),
    socialLinks: accountLinks(accounts),
    latestPosts: latestPerPlatform(input.posts),
    // 公開ページなので visibility: "public"(社内ツールなら "internal" で検索避け)
    meta: buildMeta({ title: cast.name, description: bio, canonical: `${input.baseUrl}/cast/${cast.id}`, visibility: "public" }),
  };
}

/** 指名予約の空き枠: 店のスロット × キャストのシフト − そのキャストの予約。 */
export function buildCastAvailability(input: {
  openingHours: TimeRange[];
  shifts: Shift[];
  bookings: BookingInterval[];
  slotMinutes: number;
}): { start: string; end: string }[] {
  const slots = generateSlots(input.openingHours, { slotMinutes: input.slotMinutes });
  return staffAvailableSlots(slots, input.shifts, input.bookings);
}

/** 予約リクエストの検証結果。 */
export interface BookingValidation {
  ok: boolean;
  reason?: string;
}

/** 予約可否の検証(受付期間 + キャンセル可否の情報)。 */
export function validateBookingRequest(bookingAt: string, now?: Date): BookingValidation {
  const check = isWithinBookingWindow(bookingAt, { minLeadMinutes: 60, maxAdvanceDays: 30 }, now);
  return { ok: check.ok, reason: check.reason };
}

/** 予約確定時のリマインダー設定(前日メール + 2時間前SMS)。 */
export function scheduleBookingReminders(bookingAt: string) {
  return reminderSchedule(bookingAt, [
    { beforeMinutes: 1440, channel: "email" },
    { beforeMinutes: 120, channel: "sms" },
  ]);
}

/** 予約ステータスの日本語ラベル(表示用の再エクスポート)。 */
export const statusLabel = BOOKING_STATUS_LABELS;

/** キャンセル可能かの判定(24時間前まで)。 */
export function canCancelBooking(bookingAt: string, now?: Date): boolean {
  return canCancel(bookingAt, 1440, now);
}
