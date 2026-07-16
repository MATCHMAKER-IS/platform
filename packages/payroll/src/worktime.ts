/**
 * 勤怠時間の集計(純ロジック)。
 * 出退勤・休憩から実労働時間を求め、法定労働時間を超える時間外・深夜(22:00〜翌5:00)・
 * 法定休日の各区分に振り分ける。給与計算の入力を作る。
 * 時刻は「その日の 0:00 からの分」で表す(日をまたぐ勤務は end > 1440 で表現)。
 * @packageDocumentation
 */

/** 法定労働時間(1日)= 8 時間 = 480 分。 */
export const LEGAL_DAILY_MINUTES = 480;
/** 深夜労働の時間帯(22:00〜翌5:00)。 */
export const NIGHT_START_MIN = 22 * 60; // 1320
export const NIGHT_END_MIN = 5 * 60;    // 300(翌日)

/**
 * `HH:MM` を 0:00 からの分に変換する。
 *
 * **深夜勤務は 24 時を超える**(`26:00` = 翌 2:00)ので、Date ではなく分で扱う。
 *
 * @param hhmm `HH:MM` 形式
 * @returns 0:00 からの分数
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — `HH:MM` 形式でない場合
 */
export function parseTimeToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) throw new Error(`不正な時刻: ${hhmm}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59) throw new Error(`不正な分: ${hhmm}`);
  return h * 60 + min;
}

/**
 * 2 つの時間帯の重なりを分で返す。
 *
 * **深夜割増の計算に使う**(勤務時間と 22:00〜5:00 の重なり)。
 *
 * @param a 時間帯(開始・終了の分)
 * @param b 時間帯
 * @returns 重なりの分数。**重ならなければ 0**
 */
export function overlapMinutes(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

/**
 * 勤務区間 [startMin, endMin) のうち深夜時間帯(22:00〜翌5:00)に入る分を返す。
 * 日をまたぐ勤務にも対応(前後日ぶんの深夜窓と重ね合わせる)。
 *
 * @param work 勤務時間帯
 * @returns 深夜(**22:00〜翌 5:00**)に当たる分数。労基法の深夜割増の対象
 */
export function nightMinutes(startMin: number, endMin: number): number {
  let total = 0;
  // 深夜窓 = 各日の [22:00, 翌5:00]。前後日ぶんも考慮して重なりを合算。
  for (const k of [-1, 0, 1]) {
    const winStart = NIGHT_START_MIN + 1440 * k;          // 22:00 + k日
    const winEnd = NIGHT_START_MIN + (5 + 24 - 22) * 60 + 1440 * k; // = 22:00 + 7h = 翌5:00
    total += overlapMinutes(startMin, endMin, winStart, winEnd);
  }
  return total;
}

/** 勤怠区分ごとの時間(分)。 */
export interface WorkSplit {
  /** 実労働時間(休憩控除後)。 */
  totalMinutes: number;
  /** 時間外労働(法定労働時間を超えた分。法定休日には計上しない)。 */
  overtimeMinutes: number;
  /** 深夜労働(区分に関わらず 22:00〜5:00 に入る分)。 */
  nightMinutes: number;
  /** 法定休日労働(その日が法定休日なら実労働時間の全体)。 */
  holidayMinutes: number;
}

/** {@link splitDailyWork} の入力。 */
export interface DailyWorkInput {
  /** 始業(0:00 からの分)。 */
  startMin: number;
  /** 終業(0:00 からの分。日をまたぐ場合は 1440 超)。 */
  endMin: number;
  /** 休憩(分)。 */
  breakMinutes?: number;
  /** 1 日の法定労働時間(分・既定 480)。 */
  legalDailyMinutes?: number;
  /** その日が法定休日か。 */
  isHoliday?: boolean;
}

/**
 * 1 日の勤怠を区分ごとの時間に分ける。
 * 休憩は実労働時間から差し引く。深夜時間は勤務区間全体に対して計算する(休憩の深夜控除はしない簡易版)。
 *
 * @param work 勤務時間帯
 * @param scheduled 所定労働時間
 * @returns 所定内・時間外・深夜に分けた分数(**重複して数える**。深夜の時間外は両方に計上され、割増も加算される)
 */
export function splitDailyWork(input: DailyWorkInput): WorkSplit {
  const brk = input.breakMinutes ?? 0;
  const legal = input.legalDailyMinutes ?? LEGAL_DAILY_MINUTES;
  const worked = Math.max(0, input.endMin - input.startMin - brk);
  const night = Math.min(nightMinutes(input.startMin, input.endMin), worked);
  if (input.isHoliday) {
    return { totalMinutes: worked, overtimeMinutes: 0, nightMinutes: night, holidayMinutes: worked };
  }
  const overtime = Math.max(0, worked - legal);
  return { totalMinutes: worked, overtimeMinutes: overtime, nightMinutes: night, holidayMinutes: 0 };
}
