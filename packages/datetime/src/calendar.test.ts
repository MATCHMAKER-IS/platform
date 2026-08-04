import {
  describe, it, expect } from "vitest"; import {   isLeapYear, daysInMonth, addDays, addMonths, addYears, daysBetween, daysUntil, isPast, isFuture, isSameDay, isToday, age, weekdayNameJa, isWeekend, quarter, startOfMonth, endOfMonth, startOfWeek, formatDate, parseDate, holidayName, holidaysInYear, isBusinessDay, addBusinessDays, businessDaysBetween, rangeContains, rangesOverlap, rangeIntersection, rangeDays, eachDayOfRange, splitRangeByMonth, clampDate, toWareki, formatWareki, formatRelativeDay, roundToNearestMinutes, floorToMinutes, ceilToMinutes, formatDuration, parseDuration, businessMinutesBetween, todayJst, formatDateJst, dayNumber, dayNumberJst, dayOfWeek, isBeforeDay, isAfterDay, utcDate, isHoliday, formatClock,
} from "./calendar";

const D = (s: string) => new Date(s + "T00:00:00Z");

describe("basics", () => {
  it("leap year", () => { expect(isLeapYear(2024)).toBe(true); expect(isLeapYear(1900)).toBe(false); expect(isLeapYear(2000)).toBe(true); });
  it("daysInMonth", () => { expect(daysInMonth(2024, 2)).toBe(29); expect(daysInMonth(2023, 2)).toBe(28); });
});

describe("arithmetic", () => {
  it("addDays", () => expect(formatDate(addDays(D("2024-02-28"), 1))).toBe("2024-02-29"));
  it("addMonths clamp", () => { expect(formatDate(addMonths(D("2024-01-31"), 1))).toBe("2024-02-29"); expect(formatDate(addMonths(D("2023-01-31"), 1))).toBe("2023-02-28"); });
  it("addYears leap", () => expect(formatDate(addYears(D("2024-02-29"), 1))).toBe("2025-02-28"));
  it("daysBetween/until", () => { expect(daysBetween(D("2024-01-01"), D("2024-12-31"))).toBe(365); expect(daysUntil(D("2024-01-10"), D("2024-01-01"))).toBe(9); });
});

describe("compare/age", () => {
  it("past/future", () => { expect(isPast(D("2020-01-01"), D("2024-01-01"))).toBe(true); expect(isFuture(D("2030-01-01"), D("2024-01-01"))).toBe(true); });
  it("sameDay/today", () => {
    // 暦日は JST 基準。01:00Z = 5/1 10:00 JST、23:00Z = **5/2 08:00 JST** なので別日
    expect(isSameDay(new Date("2024-05-01T01:00:00Z"), new Date("2024-05-01T23:00:00Z"))).toBe(false);
    // 同じ JST 日どうしは true
    expect(isSameDay(new Date("2024-05-01T01:00:00Z"), new Date("2024-05-01T14:00:00Z"))).toBe(true);
    expect(isToday(D("2024-05-01"), new Date("2024-05-01T10:00:00Z"))).toBe(true);
  });
  it("age", () => { expect(age(D("1990-06-15"), D("2024-06-14"))).toBe(33); expect(age(D("1990-06-15"), D("2024-06-15"))).toBe(34); expect(age(D("2000-02-29"), D("2024-02-28"))).toBe(23); });
});

describe("calendar helpers", () => {
  it("weekday/weekend", () => { expect(weekdayNameJa(D("2024-01-01"))).toBe("月"); expect(isWeekend(D("2024-01-06"))).toBe(true); });
  it("quarter", () => { expect(quarter(D("2024-01-15"))).toBe(1); expect(quarter(D("2024-12-31"))).toBe(4); });
  it("month/week bounds", () => { expect(formatDate(endOfMonth(D("2024-02-15")))).toBe("2024-02-29"); expect(formatDate(startOfMonth(D("2024-02-15")))).toBe("2024-02-01"); expect(formatDate(startOfWeek(D("2024-01-03")))).toBe("2024-01-01"); });
  it("parseDate", () => { expect(formatDate(parseDate("2024-03-05")!)).toBe("2024-03-05"); expect(parseDate("2024-13-01")).toBeNull(); expect(parseDate("2023-02-29")).toBeNull(); });
});

describe("holidays", () => {
  it("fixed/happy-monday/equinox", () => { expect(holidayName(D("2024-01-01"))).toBe("元日"); expect(holidayName(D("2024-01-08"))).toBe("成人の日"); expect(holidayName(D("2024-03-20"))).toBe("春分の日"); expect(holidayName(D("2024-09-22"))).toBe("秋分の日"); });
  it("substitute", () => expect(holidayName(D("2024-02-12"))).toBe("振替休日"));
  it("olympic exception 2021", () => { expect(holidayName(D("2021-07-22"))).toBe("海の日"); expect(holidayName(D("2021-08-08"))).toBe("山の日"); });
  it("citizens holiday 2015", () => expect(holidayName(D("2015-09-22"))).toBe("国民の休日"));
  it("count", () => expect(holidaysInYear(2024).length).toBeGreaterThanOrEqual(16));
});

describe("business days", () => {
  it("isBusinessDay", () => { expect(isBusinessDay(D("2024-01-01"))).toBe(false); expect(isBusinessDay(D("2024-01-06"))).toBe(false); expect(isBusinessDay(D("2024-01-04"))).toBe(true); });
  it("addBusinessDays skips holidays", () => expect(formatDate(addBusinessDays(D("2023-12-29"), 1))).toBe("2024-01-02"));
  it("businessDaysBetween", () => expect(businessDaysBetween(D("2024-01-01"), D("2024-01-08"))).toBe(4));
});

describe("range", () => {
  const R = (a: string, b: string) => ({ start: D(a), end: D(b) });
  it("contains/overlap", () => { expect(rangeContains(R("2024-01-01", "2024-01-31"), D("2024-01-15"))).toBe(true); expect(rangesOverlap(R("2024-01-01", "2024-01-20"), R("2024-01-15", "2024-02-01"))).toBe(true); });
  it("intersection", () => { const i = rangeIntersection(R("2024-01-01", "2024-01-20"), R("2024-01-15", "2024-02-01"))!; expect(formatDate(i.start)).toBe("2024-01-15"); expect(formatDate(i.end)).toBe("2024-01-20"); });
  it("days/each", () => { expect(rangeDays(R("2024-01-01", "2024-01-31"))).toBe(31); expect(eachDayOfRange(R("2024-01-01", "2024-01-03")).length).toBe(3); });
  it("splitByMonth", () => expect(splitRangeByMonth(R("2024-01-15", "2024-03-10")).length).toBe(3));
  it("clamp", () => expect(formatDate(clampDate(D("2023-12-01"), R("2024-01-01", "2024-12-31")))).toBe("2024-01-01"));
});

describe("wareki/relative", () => {
  it("wareki", () => { expect(formatWareki(D("2019-05-01"))).toBe("令和元年"); expect(formatWareki(D("2019-04-30"))).toBe("平成31年"); expect(formatWareki(D("1989-01-08"))).toBe("平成元年"); });
  it("pre-meiji", () => { expect(toWareki(D("1850-01-01"))).toBeNull(); expect(formatWareki(D("1850-01-01"))).toBe("1850年"); });
  it("relative", () => { expect(formatRelativeDay(D("2024-01-05"), D("2024-01-05"))).toBe("今日"); expect(formatRelativeDay(D("2024-01-10"), D("2024-01-05"))).toBe("5日後"); expect(formatRelativeDay(D("2023-12-31"), D("2024-01-05"))).toBe("5日前"); });
});

describe("time/duration", () => {
  const T = (s: string) => new Date(s + "Z");
  it("round minutes", () => { expect(roundToNearestMinutes(T("2024-01-01T10:07:00"), 15).toISOString()).toBe("2024-01-01T10:00:00.000Z"); expect(ceilToMinutes(T("2024-01-01T10:01:00"), 15).toISOString()).toBe("2024-01-01T10:15:00.000Z"); expect(floorToMinutes(T("2024-01-01T10:14:00"), 15).toISOString()).toBe("2024-01-01T10:00:00.000Z"); });
  it("formatDuration", () => { expect(formatDuration(9000)).toBe("2時間30分"); expect(formatDuration(90061, { maxUnits: 3 })).toBe("1日1時間1分"); expect(formatDuration(0)).toBe("0秒"); expect(formatDuration(9000, { short: true })).toBe("2h30m"); });
  it("parseDuration", () => { expect(parseDuration("2時間30分")).toBe(9000); expect(parseDuration("1日3時間")).toBe(97200); expect(parseDuration("abc")).toBeNull(); });
  it("businessMinutes", () => { expect(businessMinutesBetween(T("2024-01-04T10:00:00"), T("2024-01-05T15:00:00"))).toBe(840); expect(businessMinutesBetween(T("2024-01-01T09:00:00"), T("2024-01-01T18:00:00"))).toBe(0); });
});

describe("JST の暦日(9 時間ずれ対策)", () => {
  // JST 2026-07-29 00:30 = UTC 2026-07-28 15:30。
  // ここが「昨日」に見えるのが、UTC 基準の日付計算で起きる典型的な不具合。
  const jst0030 = new Date("2026-07-29T00:30:00+09:00");
  const jst0800 = new Date("2026-07-29T08:00:00+09:00"); // UTC ではまだ 07-28
  const jst1000 = new Date("2026-07-29T10:00:00+09:00"); // UTC では 07-29

  it("todayJst は JST の暦日を UTC 0 時の Date で返す", () => {
    expect(todayJst(jst0030).toISOString()).toBe("2026-07-29T00:00:00.000Z");
    expect(todayJst(jst1000).toISOString()).toBe("2026-07-29T00:00:00.000Z");
  });

  it("formatDateJst は JST の日付を返す(toISOString().slice(0,10) の置き換え)", () => {
    expect(formatDateJst(jst0030)).toBe("2026-07-29");
    // 比較: UTC で切ると前日になる
    expect(jst0030.toISOString().slice(0, 10)).toBe("2026-07-28");
  });

  it("UTC の日付をまたぐ 2 時刻でも、同じ JST 日なら isSameDay は true", () => {
    expect(isSameDay(jst0800, jst1000)).toBe(true);
    expect(isSameDay(jst0030, jst1000)).toBe(true);
  });

  it("JST 深夜でも isToday が今日を今日と判定する", () => {
    expect(isToday(utcDate(2026, 7, 29), jst0030)).toBe(true);
    expect(isToday(utcDate(2026, 7, 28), jst0030)).toBe(false);
  });

  it("JST 深夜でも daysUntil が 0 になる(期限が今日のものを明日扱いしない)", () => {
    expect(daysUntil(utcDate(2026, 7, 29), jst0030)).toBe(0);
    expect(daysUntil(utcDate(2026, 7, 30), jst0030)).toBe(1);
  });

  it("暦日の前後比較も JST 基準", () => {
    expect(isBeforeDay(jst0030, utcDate(2026, 7, 30))).toBe(true);
    expect(isAfterDay(jst0030, utcDate(2026, 7, 28))).toBe(true);
    expect(isBeforeDay(jst0800, jst1000)).toBe(false); // 同じ日
  });

  it("曜日も JST 基準(月曜の早朝を日曜にしない)", () => {
    // 2026-08-03 は月曜。JST 月曜 08:00 は UTC ではまだ日曜
    expect(dayOfWeek(new Date("2026-08-03T08:00:00+09:00"))).toBe(1);
  });

  it("祝日判定も JST 基準(元日の朝を前年扱いしない)", () => {
    // 2027-01-01 元日。JST 元日 08:00 は UTC ではまだ 2026-12-31
    expect(isHoliday(new Date("2027-01-01T08:00:00+09:00"))).toBe(true);
    expect(holidayName(new Date("2027-01-01T08:00:00+09:00"))).toBe("元日");
  });

  it("日付だけの値(utcDate)では dayNumber と dayNumberJst が一致する", () => {
    // 既存の祝日表・営業日計算が影響を受けないことの担保
    for (const d of [utcDate(2026, 1, 1), utcDate(2026, 7, 29), utcDate(2026, 12, 31)]) {
      expect(dayNumberJst(d)).toBe(dayNumber(d));
    }
  });
});

describe("formatClock(時計表示)", () => {
  it("1 時間未満は mm:ss", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(9)).toBe("00:09");
    expect(formatClock(90)).toBe("01:30");
    expect(formatClock(3599)).toBe("59:59");
  });

  it("1 時間以上は h:mm:ss", () => {
    expect(formatClock(3600)).toBe("1:00:00");
    expect(formatClock(3661)).toBe("1:01:01");
  });

  it("負は 0 として扱う(「-01:30」と出さない)", () => {
    expect(formatClock(-10)).toBe("00:00");
  });

  it("**桁が揃う**(formatDuration は揃わない)", () => {
    // カウントダウンで毎秒幅が変わると読みにくい
    expect(formatClock(65)).toBe("01:05");
    expect(formatDuration(65)).toBe("1分5秒");
  });
});
