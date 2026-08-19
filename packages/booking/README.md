# @platform/booking

予約（会議室・設備・面談）。**重なりを防ぎます**。

## これは何のためか

**「同じ部屋を 2 人が押さえた」を防ぐ**ためのものです。

紙やホワイトボードだと、**遠隔の人が見られません**。

## 使う前に知っておくこと

| | |
|---|---|
| **時間は半開区間 `[開始, 終了)`** | 10:00-11:00 と 11:00-12:00 は**重なりません**。閉区間にすると**境目で必ず衝突**します |
| **キャンセルは数えません** | 「有効な予約だけ」で重なりを見ます |
| **同時押しは DB で防ぐ** | 「空いているか確認 → 予約」の間に**別の人が入ります**。**一意制約**で弾いてください |
| **繰り返しの予約は個別に持つ** | 「毎週月曜」を 1 件で持つと、**1 回だけ動かす**ときに困ります |

## よく使うもの

```ts
import { intervalsOverlap, countOverlapping, isSlotAvailable } from "@platform/booking";
import { resolveDayHours, isOpenAt, isBusinessDay } from "@platform/booking";
const weekly = { 1: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "18:00" }], 0: [] };  // 月:昼休みあり, 日:休
resolveDayHours("2025-07-28", weekly, { closedDates: ["2025-08-13"], specialDates: { "2025-12-31": [{ open: "10:00", close: "15:00" }] } });
isOpenAt("2025-07-28", "12:30", weekly);   // false(昼休み)
```

## スロット生成
```ts
import { generateSlots } from "@platform/booking";
generateSlots([{ open: "09:00", close: "12:00" }, { open: "13:00", close: "18:00" }], { slotMinutes: 60 });
// [{ start:"09:00", end:"10:00" }, ...] 昼休みを挟んで8枠
generateSlots(ranges, { slotMinutes: 60, stepMinutes: 30 });   // 30分刻みで開始
```

## 空き枠(キャパシティ考慮)
キャストや席が複数あれば capacity を上げます。
```ts
import { availableSlots, remainingCapacity, hasConflict } from "@platform/booking";
availableSlots(slots, existingBookings, 2);        // 同時2件まで受入可能なら空き枠を返す
remainingCapacity(slots, existingBookings, 3);     // 各枠の残り受入数
hasConflict({ start: "10:00", end: "11:00" }, existingBookings, 1);   // 新規予約が枠を超えるか
```

## 予約ルール
```ts
import { isWithinBookingWindow, canCancel, validatePartySize, RULE_MESSAGES } from "@platform/booking";
isWithinBookingWindow(bookingAt, { minLeadMinutes: 60, maxAdvanceDays: 30 });  // 1時間前〜30日先まで
canCancel(bookingAt, 1440);                        // 24時間前までキャンセル可
validatePartySize(2, { min: 1, max: 4 });          // 人数チェック
// 不可のとき: RULE_MESSAGES[check.reason] で日本語メッセージ
```

## 予約ステータス
```ts
import { canTransition, nextStatuses, isActiveBooking, BOOKING_STATUS_LABELS } from "@platform/booking";
// リクエスト中 → 予約確定 → 来店完了 / キャンセル / 無断キャンセル
canTransition("requested", "confirmed");
isActiveBooking(status);   // 枠を占有するか(キャンセル系は解放)
```

## 予約リマインダー
前日・当日・1時間前などの通知を計算します。送信は `@platform/mail`/`@platform/sms`、定期実行は `@platform/cron`。
```ts
import { reminderSchedule, dueReminders, reminderMessage } from "@platform/booking";

const sched = reminderSchedule(bookingAt, [{ beforeMinutes: 1440, channel: "email" }, { beforeMinutes: 60, channel: "sms" }]);
// cron で定期実行し、送るべきものを取得(送信済みは除外)
const due = dueReminders(bookingId, sched, new Date(), { sentKeys, graceMinutes: 30 });
for (const r of due) send(r.channel, reminderMessage({ customerName, bookingAt, beforeMinutes: r.beforeMinutes }));
```

## スタッフ/キャストのシフトと空き枠
店のスロットに各スタッフの勤務時間を重ね、指名予約の空き枠や時間帯別の受入人数を出します。
```ts
import { staffAvailableSlots, slotStaffing, availableWithStaffing, generateSlots } from "@platform/booking";

const slots = generateSlots(openingHours, { slotMinutes: 60 });
staffAvailableSlots(slots, castShift, castBookings);   // 指名予約: シフト内 − そのキャストの予約

// 複数スタッフ → 時間帯ごとの受入人数(動的キャパシティ)
slotStaffing(slots, { aoi: [...], kaede: [...] });     // 各枠の勤務スタッフ数
availableWithStaffing(slots, staffShifts, bookings);   // 勤務人数 > 予約数 の空き枠
```

