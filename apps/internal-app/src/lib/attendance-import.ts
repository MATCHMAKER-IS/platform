/**
 * 勤怠打刻の CSV 取込(アプリ層)。CSV を勤怠レコードに変換し、行ごとに検証する。
 * パースは @platform/csv、時刻・労働時間の計算は勤怠ロジックに委譲。
 * @packageDocumentation
 */
import { parseCsv } from "@platform/csv";
import { hhmmToMinutes, workedMinutes } from "./attendance";

/** 取込後の勤怠レコード。 */
export interface ImportedAttendance {
  employeeId: string;
  date: string;
  clockIn: string;
  clockOut: string;
  /** 実労働(分)。休憩は breakMinutes を控除。 */
  workedMinutes: number;
}

/** 取込エラー(行番号と理由)。 */
export interface ImportError {
  row: number;
  reason: string;
}

/** 取込結果。 */
export interface ImportResult {
  records: ImportedAttendance[];
  errors: ImportError[];
}

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * 勤怠 CSV を取り込む。列: 社員番号, 日付, 出勤, 退勤, 休憩(分)。
 * ヘッダ行必須。不正な行は errors に集め、正しい行だけ records に入れる。
 */
export function parseAttendanceCsv(text: string): ImportResult {
  const rows = parseCsv(text, { header: true }) as Record<string, string>[];
  const records: ImportedAttendance[] = [];
  const errors: ImportError[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + 2; // ヘッダ + 1 始まり
    const employeeId = (row["社員番号"] ?? row["employeeId"] ?? "").trim();
    const date = (row["日付"] ?? row["date"] ?? "").trim();
    const clockIn = (row["出勤"] ?? row["clockIn"] ?? "").trim();
    const clockOut = (row["退勤"] ?? row["clockOut"] ?? "").trim();
    const breakRaw = (row["休憩"] ?? row["breakMinutes"] ?? "0").trim();

    if (!employeeId) { errors.push({ row: rowNum, reason: "社員番号が空です" }); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push({ row: rowNum, reason: `日付が不正です: ${date}` }); return; }
    if (!HHMM.test(clockIn) || !HHMM.test(clockOut)) { errors.push({ row: rowNum, reason: "出勤/退勤の時刻が不正です" }); return; }

    const inMin = hhmmToMinutes(clockIn);
    const outMin = hhmmToMinutes(clockOut);
    if (outMin <= inMin) { errors.push({ row: rowNum, reason: "退勤が出勤以前です" }); return; }
    const breakMin = Number(breakRaw);
    if (!Number.isFinite(breakMin) || breakMin < 0) { errors.push({ row: rowNum, reason: `休憩時間が不正です: ${breakRaw}` }); return; }

    records.push({ employeeId, date, clockIn, clockOut, workedMinutes: workedMinutes(inMin, outMin, breakMin) });
  });

  return { records, errors };
}

/** 取込結果を社員ごとに集計する(件数・合計労働分)。 */
export function summarizeByEmployee(records: ImportedAttendance[]): { employeeId: string; days: number; totalMinutes: number }[] {
  const map = new Map<string, { days: number; totalMinutes: number }>();
  const order: string[] = [];
  for (const r of records) {
    if (!map.has(r.employeeId)) { map.set(r.employeeId, { days: 0, totalMinutes: 0 }); order.push(r.employeeId); }
    const e = map.get(r.employeeId)!;
    e.days += 1;
    e.totalMinutes += r.workedMinutes;
  }
  return order.map((employeeId) => ({ employeeId, ...map.get(employeeId)! }));
}
