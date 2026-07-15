/**
 * 日付・時刻ユーティリティ(外部依存なし・UTC カレンダー基準の純ロジック)。
 *
 * 日付のみの計算(年齢・日数差・祝日)は UTC の暦日で扱う。時刻を含む比較は
 * インスタント(getTime)で行う。JST での境界計算が必要な場合は index.ts の
 * `startOfDayJst` 等と併用すること。
 * @packageDocumentation
 */

const MS_PER_DAY = 86_400_000;

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }

// ───────────────────────── 基本 ─────────────────────────

/**
 * 閏年かを判定する。
 *
 * @param year 西暦年
 * @returns 閏年なら true(4 で割り切れ、100 で割り切れず、400 で割り切れる年は閏年)
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * その月の日数を返す。
 *
 * @param year  西暦年
 * @param month **1〜12**(JavaScript の Date と違い 0 始まりではない)
 * @returns 28〜31
 */
export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}

/**
 * UTC 暦日での通日番号を返す(1970-01-01 = 0)。
 *
 * **時刻を無視して日付だけ比較する**ときに使う。`getTime()` の比較だと
 * 同じ日でも時刻が違えば別物になってしまう。
 *
 * @param date 対象の日時
 * @returns 1970-01-01 からの日数(負もありうる)
 */
export function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / MS_PER_DAY);
}

/**
 * UTC の年月日から Date を作る(時刻は 00:00:00 UTC)。
 *
 * `new Date(2026, 6, 15)` は**ローカルタイムゾーン**で解釈され、環境によって日付がずれる。
 * 日付だけを扱いたいときはこちらを使う。
 *
 * @param year  西暦年
 * @param month **1〜12**(0 始まりではない)
 * @param day   1〜31
 * @returns UTC の 00:00:00 に固定した Date
 */
export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

// ───────────────────────── 加算・差分 ─────────────────────────

/**
 * n 日後の日付を返す。
 *
 * @param date 基準日
 * @param n    日数(**負なら過去**)
 * @returns 新しい Date(元は変更しない)
 */
export function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * MS_PER_DAY);
}

/**
 * n ヶ月後の日付を返す。
 *
 * **月末はクランプする**(1/31 の 1 ヶ月後は 3/3 ではなく 2/28)。
 * 素朴に月だけ足すと 2 月を飛び越えてしまうため。
 *
 * @param date 基準日
 * @param n    月数(負なら過去)
 * @returns 新しい Date(元は変更しない)
 *
 * @example
 * ```ts
 * addMonths(utcDate(2026, 1, 31), 1);  // => 2026-02-28(3/3 にはならない)
 * ```
 */
export function addMonths(date: Date, n: number): Date {
  const total = date.getUTCMonth() + n;
  const ny = date.getUTCFullYear() + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const nd = Math.min(date.getUTCDate(), daysInMonth(ny, nm + 1));
  return new Date(Date.UTC(ny, nm, nd, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}

/**
 * n 年後の日付を返す。
 *
 * **2/29 は非閏年で 2/28 にクランプ**する(3/1 にはしない)。
 *
 * @param date 基準日
 * @param n    年数(負なら過去)
 * @returns 新しい Date(元は変更しない)
 */
export function addYears(date: Date, n: number): Date {
  return addMonths(date, n * 12);
}

/**
 * 暦日での日数差を返す(`b - a`)。**時刻は無視する**。
 *
 * @param a 始点
 * @param b 終点
 * @returns 日数(b が過去なら負)。同じ日なら 0
 */
export function daysBetween(a: Date, b: Date): number {
  return dayNumber(b) - dayNumber(a);
}

/**
 * 期限までの残り日数を返す。
 *
 * @param date 期限
 * @param from 基準日(既定は今日。テスト注入用)
 * @returns 残り日数(**過ぎていれば負**)。同じ日なら 0
 */
export function daysUntil(date: Date, from: Date = new Date()): number {
  return daysBetween(from, date);
}

// ───────────────────────── 比較 ─────────────────────────

/**
 * 同じ暦日かを判定する(UTC・時刻は無視)。
 *
 * @param a 比較する日時
 * @param b 比較する日時
 * @returns 同じ日なら true(時刻が違っても true)
 */
export function isSameDay(a: Date, b: Date): boolean {
  return dayNumber(a) === dayNumber(b);
}

/**
 * now より過去のインスタントか。
 *
 * @param date 判定する日付
 * @param today 基準日(テスト注入用)
 * @returns 基準日より前なら true(**同じ日は false**)
 */
export function isPast(date: Date, now: Date = new Date()): boolean {
  return date.getTime() < now.getTime();
}

/**
 * now より未来のインスタントか。
 *
 * @param date 判定する日付
 * @param today 基準日(テスト注入用)
 * @returns 基準日より後なら true(**同じ日は false**)
 */
export function isFuture(date: Date, now: Date = new Date()): boolean {
  return date.getTime() > now.getTime();
}

/**
 * 今日(same day)か。
 *
 * @param date 判定する日付
 * @param today 基準日(テスト注入用)
 * @returns 同じ暦日なら true(時刻は無視)
 */
export function isToday(date: Date, now: Date = new Date()): boolean {
  return isSameDay(date, now);
}

/**
 * a は b より前の暦日か。
 *
 * @param a 比較する日付
 * @param b 比較する日付
 * @returns a が b より前の暦日なら true(時刻は無視)
 */
export function isBeforeDay(a: Date, b: Date): boolean { return dayNumber(a) < dayNumber(b); }
/**
 * a は b より後の暦日か。
 *
 * @param a 比較する日付
 * @param b 比較する日付
 * @returns a が b より後の暦日なら true(時刻は無視)
 */
export function isAfterDay(a: Date, b: Date): boolean { return dayNumber(a) > dayNumber(b); }

// ───────────────────────── 年齢・曜日・四半期 ─────────────────────────

/**
 * 生年月日から満年齢を求める。
 *
 * @param birthDate 生年月日
 * @param today 基準日(テスト注入用。既定は今日)
 * @returns 満年齢(誕生日前なら 1 歳少ない)
 */
export function age(birth: Date, at: Date = new Date()): number {
  let a = at.getUTCFullYear() - birth.getUTCFullYear();
  const m = at.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < birth.getUTCDate())) a--;
  return a;
}

/**
 * 曜日番号(0=日〜6=土)。
 *
 * @param date 対象の日付
 * @returns 0=日曜 〜 6=土曜(JavaScript の getUTCDay と同じ)
 */
export function dayOfWeek(date: Date): number {
  return new Date(dayNumber(date) * MS_PER_DAY).getUTCDay();
}

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * 日本語の曜日(「月」など)。
 *
 * @param date 対象の日付
 * @returns 「月」「火」など 1 文字
 */
export function weekdayNameJa(date: Date): string {
  return WEEKDAY_JA[dayOfWeek(date)]!;
}

/**
 * 土日か。
 *
 * @param date 対象の日付
 * @returns 土曜または日曜なら true(**祝日は含まない**。祝日は isHoliday で見る)
 */
export function isWeekend(date: Date): boolean {
  const d = dayOfWeek(date);
  return d === 0 || d === 6;
}

/**
 * 四半期(1〜4)。
 *
 * @param date 対象の日付
 * @returns 1〜4(1〜3月が Q1。**日本の年度(4月始まり)ではなく暦年**)
 */
export function quarter(date: Date): number {
  return Math.floor(date.getUTCMonth() / 3) + 1;
}

// ───────────────────────── 月初・月末・週初 ─────────────────────────

/**
 * 月初(UTC 00:00)。
 *
 * @param date 対象の日付
 * @returns その月の 1 日(UTC 00:00:00)
 */
export function startOfMonth(date: Date): Date {
  return utcDate(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

/**
 * 月末(UTC 00:00)。
 *
 * @param date 対象の日付
 * @returns その月の末日(UTC 00:00:00)。月の日数はクランプ済み
 */
export function endOfMonth(date: Date): Date {
  const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1;
  return utcDate(y, m, daysInMonth(y, m));
}

/**
 * 週初(既定は月曜始まり)。weekStartsOn: 0=日,1=月。
 *
 * @param date 対象の日付
 * @param weekStartsOn 週の始まり(0=日曜・1=月曜。既定 1)
 * @returns その週の始まりの日(UTC 00:00:00)
 */
export function startOfWeek(date: Date, weekStartsOn = 1): Date {
  const d = dayOfWeek(date);
  const diff = (d - weekStartsOn + 7) % 7;
  return addDays(utcDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()), -diff);
}

// ───────────────────────── 整形・パース ─────────────────────────

/**
 * YYYY-MM-DD(UTC)。
 *
 * @param date 対象の日付
 * @returns YYYY-MM-DD(UTC 基準。ローカルタイムゾーンの影響を受けない)
 */
export function formatDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/**
 * YYYY-MM-DD を UTC の Date にパース。不正は null。
 *
 * @param ymd YYYY-MM-DD 形式の文字列
 * @returns UTC 00:00:00 の Date
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 形式が不正、または実在しない日付の場合
 */
export function parseDate(text: string): Date | null {
  const m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return utcDate(y, mo, d);
}

// ───────────────────────── 祝日(日本) ─────────────────────────

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (weekday - first + 7) % 7;
  return 1 + offset + (n - 1) * 7;
}

function vernalEquinoxDay(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}
function autumnalEquinoxDay(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

/** 祝日 1 件。 */
export interface Holiday { date: Date; name: string }

/**
 * その年の日本の祝日一覧(振替休日・国民の休日を含む・1948年以降を想定)。
 *
 * @param year 西暦年
 * @returns その年の祝日(YYYY-MM-DD → 名前)。振替休日・国民の休日を含む
 */
export function holidaysInYear(year: number): Holiday[] {
  const base = new Map<number, string>(); // dayNumber -> name
  const add = (month: number, day: number, name: string) => base.set(dayNumber(utcDate(year, month, day)), name);

  add(1, 1, "元日");
  add(1, nthWeekdayOfMonth(year, 1, 1, 2), "成人の日");
  add(2, 11, "建国記念の日");
  if (year >= 2020) add(2, 23, "天皇誕生日");
  add(3, vernalEquinoxDay(year), "春分の日");
  add(4, 29, year >= 2007 ? "昭和の日" : "みどりの日");
  add(5, 3, "憲法記念日");
  if (year >= 2007) add(5, 4, "みどりの日");
  add(5, 5, "こどもの日");
  // 海の日(2020/2021 は五輪特例)
  if (year === 2020) add(7, 23, "海の日");
  else if (year === 2021) add(7, 22, "海の日");
  else if (year >= 2003) add(7, nthWeekdayOfMonth(year, 7, 1, 3), "海の日");
  else if (year >= 1996) add(7, 20, "海の日");
  // 山の日(2020/2021 特例、2016 制定)
  if (year === 2020) add(8, 10, "山の日");
  else if (year === 2021) add(8, 8, "山の日");
  else if (year >= 2016) add(8, 11, "山の日");
  add(9, nthWeekdayOfMonth(year, 9, 1, 3), "敬老の日");
  add(9, autumnalEquinoxDay(year), "秋分の日");
  // スポーツの日/体育の日(2020/2021 特例)
  if (year === 2020) add(7, 24, "スポーツの日");
  else if (year === 2021) add(7, 23, "スポーツの日");
  else if (year >= 2020) add(10, nthWeekdayOfMonth(year, 10, 1, 2), "スポーツの日");
  else if (year >= 2000) add(10, nthWeekdayOfMonth(year, 10, 1, 2), "体育の日");
  add(11, 3, "文化の日");
  add(11, 23, "勤労感謝の日");

  // 振替休日: 祝日が日曜なら次の非祝日を振替に(2007 以降)
  if (year >= 2007) {
    for (const dn of [...base.keys()].sort((a, b) => a - b)) {
      if (new Date(dn * MS_PER_DAY).getUTCDay() === 0) {
        let next = dn + 1;
        while (base.has(next)) next++;
        if (!base.has(next)) base.set(next, "振替休日");
      }
    }
  }
  // 国民の休日: 祝日に挟まれた平日(日曜以外)を休日に(2007 以降)
  if (year >= 2007) {
    const start = dayNumber(utcDate(year, 1, 1));
    const end = dayNumber(utcDate(year, 12, 31));
    const additions: Array<[number, string]> = [];
    for (let dn = start + 1; dn < end; dn++) {
      if (base.has(dn)) continue;
      if (new Date(dn * MS_PER_DAY).getUTCDay() === 0) continue;
      if (base.has(dn - 1) && base.has(dn + 1)) additions.push([dn, "国民の休日"]);
    }
    for (const [dn, name] of additions) base.set(dn, name);
  }

  return [...base.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dn, name]) => ({ date: new Date(dn * MS_PER_DAY), name }));
}

const holidayCache = new Map<number, Map<number, string>>();
function holidayMap(year: number): Map<number, string> {
  let m = holidayCache.get(year);
  if (!m) {
    m = new Map(holidaysInYear(year).map((h) => [dayNumber(h.date), h.name]));
    holidayCache.set(year, m);
  }
  return m;
}

/**
 * 祝日か。
 *
 * @param date 対象の日付
 * @returns 日本の祝日なら true(**土日は含まない**。土日は isWeekend で見る)
 */
export function isHoliday(date: Date): boolean {
  return holidayMap(date.getUTCFullYear()).has(dayNumber(date));
}

/**
 * 祝日名(祝日でなければ null)。
 *
 * @param date 対象の日付
 * @returns 祝日の名前。祝日でなければ undefined
 */
export function holidayName(date: Date): string | null {
  return holidayMap(date.getUTCFullYear()).get(dayNumber(date)) ?? null;
}

// ───────────────────────── 営業日 ─────────────────────────

/**
 * 営業日(土日・祝日を除く)か。
 *
 * @param date 対象の日付
 * @param extraHolidays 会社独自の休業日(年末年始など)
 * @returns 平日かつ祝日でなければ true
 */
export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date);
}

/**
 * n 営業日後(負で前)。
 *
 * @param date 基準日
 * @param n 営業日数(**負なら過去**)
 * @param extraHolidays 会社独自の休業日
 * @returns n 営業日後の日付。土日祝を飛ばす
 */
export function addBusinessDays(date: Date, n: number): Date {
  let d = utcDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  const step = n >= 0 ? 1 : -1;
  let remaining = Math.abs(n);
  while (remaining > 0) {
    d = addDays(d, step);
    if (isBusinessDay(d)) remaining--;
  }
  return d;
}

/**
 * a〜b の営業日数(a を含まず b を含む)。
 *
 * @param a 始点
 * @param b 終点
 * @param extraHolidays 会社独自の休業日
 * @returns 営業日数(**始点を含み終点を含まない**。b が過去なら負)
 */
export function businessDaysBetween(a: Date, b: Date): number {
  const from = Math.min(dayNumber(a), dayNumber(b));
  const to = Math.max(dayNumber(a), dayNumber(b));
  let count = 0;
  for (let dn = from + 1; dn <= to; dn++) if (isBusinessDay(new Date(dn * MS_PER_DAY))) count++;
  return dayNumber(b) >= dayNumber(a) ? count : -count;
}

// ───────────────────────── 期間(range) ─────────────────────────

/** 期間(暦日ベース・両端含む)。 */
export interface DateRange { start: Date; end: Date }

/**
 * 期間に日付が含まれるか(両端含む)。
 *
 * @param range 期間
 * @param date 判定する日付
 * @returns 期間内(**両端を含む**)なら true
 */
export function rangeContains(range: DateRange, date: Date): boolean {
  const d = dayNumber(date);
  return d >= dayNumber(range.start) && d <= dayNumber(range.end);
}

/**
 * 2 期間が重なるか。
 *
 * @param a 期間
 * @param b 期間
 * @returns 1 日でも重なれば true
 */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return dayNumber(a.start) <= dayNumber(b.end) && dayNumber(b.start) <= dayNumber(a.end);
}

/**
 * 重なり期間(なければ null)。
 *
 * @param a 期間
 * @param b 期間
 * @returns 重なっている期間。**重ならなければ undefined**
 */
export function rangeIntersection(a: DateRange, b: DateRange): DateRange | null {
  if (!rangesOverlap(a, b)) return null;
  const start = dayNumber(a.start) >= dayNumber(b.start) ? a.start : b.start;
  const end = dayNumber(a.end) <= dayNumber(b.end) ? a.end : b.end;
  return { start: utcDate(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate()), end: utcDate(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()) };
}

/**
 * 期間の日数(両端含む)。
 *
 * @param range 期間
 * @returns 日数(**両端を含む**。同じ日なら 1)
 */
export function rangeDays(range: DateRange): number {
  return dayNumber(range.end) - dayNumber(range.start) + 1;
}

/**
 * 期間内の各日を配列で返す(両端含む)。
 *
 * @param range 期間
 * @returns 期間内のすべての日付(**両端を含む**)。長い期間では件数に注意
 */
export function eachDayOfRange(range: DateRange): Date[] {
  const out: Date[] = [];
  const from = dayNumber(range.start), to = dayNumber(range.end);
  for (let dn = from; dn <= to; dn++) out.push(new Date(dn * MS_PER_DAY));
  return out;
}

/**
 * 期間を月ごとに分割する。
 *
 * @param range 期間
 * @returns 月ごとに分割した期間の配列(月次集計に使う)
 */
export function splitRangeByMonth(range: DateRange): DateRange[] {
  const out: DateRange[] = [];
  let cur = utcDate(range.start.getUTCFullYear(), range.start.getUTCMonth() + 1, range.start.getUTCDate());
  while (dayNumber(cur) <= dayNumber(range.end)) {
    const monthEnd = endOfMonth(cur);
    const segEnd = dayNumber(monthEnd) <= dayNumber(range.end) ? monthEnd : utcDate(range.end.getUTCFullYear(), range.end.getUTCMonth() + 1, range.end.getUTCDate());
    out.push({ start: cur, end: segEnd });
    cur = addDays(monthEnd, 1);
  }
  return out;
}

/**
 * date を期間内にクランプする。
 *
 * @param date 対象の日付
 * @param range 収める範囲
 * @returns 範囲内なら そのまま、外なら近い方の端
 */
export function clampDate(date: Date, range: DateRange): Date {
  if (dayNumber(date) < dayNumber(range.start)) return range.start;
  if (dayNumber(date) > dayNumber(range.end)) return range.end;
  return date;
}

// ───────────────────────── 和暦 ─────────────────────────

interface EraDef { name: string; short: string; start: Date }
const ERAS: EraDef[] = [
  { name: "令和", short: "R", start: utcDate(2019, 5, 1) },
  { name: "平成", short: "H", start: utcDate(1989, 1, 8) },
  { name: "昭和", short: "S", start: utcDate(1926, 12, 25) },
  { name: "大正", short: "T", start: utcDate(1912, 7, 30) },
  { name: "明治", short: "M", start: utcDate(1868, 9, 8) },
];

/** 和暦。 */
export interface Wareki { era: string; short: string; year: number }

/**
 * 和暦に変換する(明治より前は null)。
 *
 * @param date 対象の日付
 * @returns 元号・年・月・日。明治より前は undefined
 */
export function toWareki(date: Date): Wareki | null {
  const dn = dayNumber(date);
  for (const era of ERAS) {
    if (dn >= dayNumber(era.start)) {
      return { era: era.name, short: era.short, year: date.getUTCFullYear() - era.start.getUTCFullYear() + 1 };
    }
  }
  return null;
}

/**
 * 和暦文字列(例: "令和6年")。元年表記は useGannen で。
 *
 * @param date 対象の日付
 * @returns 「令和8年7月15日」形式。明治より前は西暦にフォールバック
 */
export function formatWareki(date: Date, options: { useGannen?: boolean } = {}): string {
  const w = toWareki(date);
  if (!w) return `${date.getUTCFullYear()}年`;
  const y = options.useGannen !== false && w.year === 1 ? "元" : String(w.year);
  return `${w.era}${y}年`;
}

// ───────────────────────── 相対表記 ─────────────────────────

/**
 * 相対的な日付表記(「今日」「明日」「3日前」など)。
 *
 * @param date 対象の日付
 * @param today 基準日(テスト注入用)
 * @returns 「今日」「明日」「3日後」「2日前」など。人が読む画面向け
 */
export function formatRelativeDay(date: Date, now: Date = new Date()): string {
  const diff = daysBetween(now, date);
  const special: Record<number, string> = { 0: "今日", 1: "明日", 2: "明後日", [-1]: "昨日", [-2]: "一昨日" };
  if (diff in special) return special[diff]!;
  return diff > 0 ? `${diff}日後` : `${-diff}日前`;
}

// ───────────────────────── 時刻・所要時間 ─────────────────────────

/**
 * n 分後(負で前)。
 *
 * @param date 基準の日時
 * @param n 分(負なら過去)
 * @returns 新しい Date(元は変更しない)
 */
export function addMinutes(date: Date, n: number): Date { return new Date(date.getTime() + n * 60_000); }
/**
 * n 時間後(負で前)。
 *
 * @param date 基準の日時
 * @param n 時間(負なら過去)
 * @returns 新しい Date(元は変更しない)
 */
export function addHours(date: Date, n: number): Date { return new Date(date.getTime() + n * 3_600_000); }

/**
 * 最近接の step 分へ丸める。
 *
 * @param date 対象の日時
 * @param minutes 丸める単位(例: 15 なら 15 分刻み)
 * @returns 最も近い刻みに丸めた新しい Date
 */
export function roundToNearestMinutes(date: Date, step = 1): Date {
  const ms = step * 60_000;
  return new Date(Math.round(date.getTime() / ms) * ms);
}
/**
 * step 分単位で切り捨て。
 *
 * @param date 対象の日時
 * @param minutes 刻み
 * @returns 切り捨てた新しい Date(**勤怠の打刻でよく使う**)
 */
export function floorToMinutes(date: Date, step = 1): Date {
  const ms = step * 60_000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}
/**
 * step 分単位で切り上げ。
 *
 * @param date 対象の日時
 * @param minutes 刻み
 * @returns 切り上げた新しい Date
 */
export function ceilToMinutes(date: Date, step = 1): Date {
  const ms = step * 60_000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

/** {@link formatDuration} のオプション。 */
export interface FormatDurationOptions { maxUnits?: number; short?: boolean }

/**
 * 秒数を「2時間30分」のように整形する。
 *
 * @param ms ミリ秒
 * @returns 「1時間30分」形式。0 なら「0分」
 */
export function formatDuration(seconds: number, options: FormatDurationOptions = {}): string {
  const { maxUnits = 2, short = false } = options;
  const sign = seconds < 0 ? "-" : "";
  let s = Math.floor(Math.abs(seconds));
  const days = Math.floor(s / 86_400); s -= days * 86_400;
  const hours = Math.floor(s / 3_600); s -= hours * 3_600;
  const minutes = Math.floor(s / 60); s -= minutes * 60;
  const secs = s;
  const labels = short ? { d: "d", h: "h", m: "m", s: "s" } : { d: "日", h: "時間", m: "分", s: "秒" };
  const parts: Array<[number, string]> = [[days, labels.d], [hours, labels.h], [minutes, labels.m], [secs, labels.s]];
  const nonzero = parts.filter(([v]) => v > 0);
  if (nonzero.length === 0) return `0${labels.s}`;
  return sign + nonzero.slice(0, maxUnits).map(([v, u]) => `${v}${u}`).join("");
}

/**
 * 「2時間30分」等を秒数へパースする。不正は null。
 *
 * @param text 「1h30m」「90m」「1.5h」など
 * @returns ミリ秒。解釈できなければ undefined
 */
export function parseDuration(text: string): number | null {
  const re = /(\d+(?:\.\d+)?)\s*(日|時間|時|分|秒|d|h|m|s)/g;
  let total = 0;
  let matched = false;
  let m: RegExpExecArray | null;
  const unitSec: Record<string, number> = { "日": 86_400, "d": 86_400, "時間": 3_600, "時": 3_600, "h": 3_600, "分": 60, "m": 60, "秒": 1, "s": 1 };
  while ((m = re.exec(text))) {
    matched = true;
    total += Number(m[1]) * (unitSec[m[2]!] ?? 0);
  }
  return matched ? total : null;
}

/** 営業時間(1 日の分帯)。既定 9:00〜18:00。 */
export interface BusinessHours { openMinutes?: number; closeMinutes?: number }

/**
 * start〜end の営業時間(分)。営業日かつ日次の営業時間帯のみ計上する(UTC 時刻基準)。
 *
 * @param a 始点の日時
 * @param b 終点の日時
 * @param hours 営業時間の設定(開始・終了・休憩)
 * @param extraHolidays 会社独自の休業日
 * @returns 営業時間内の分数(**土日祝と営業時間外を除く**)
 */
export function businessMinutesBetween(start: Date, end: Date, options: BusinessHours = {}): number {
  const open = options.openMinutes ?? 9 * 60;
  const close = options.closeMinutes ?? 18 * 60;
  if (end.getTime() <= start.getTime()) return 0;
  let total = 0;
  const firstDn = dayNumber(start);
  const lastDn = dayNumber(end);
  for (let dn = firstDn; dn <= lastDn; dn++) {
    const day = new Date(dn * MS_PER_DAY);
    if (!isBusinessDay(day)) continue;
    const dayOpen = dn * MS_PER_DAY + open * 60_000;
    const dayClose = dn * MS_PER_DAY + close * 60_000;
    const from = Math.max(start.getTime(), dayOpen);
    const to = Math.min(end.getTime(), dayClose);
    if (to > from) total += Math.round((to - from) / 60_000);
  }
  return total;
}
