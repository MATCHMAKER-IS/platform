import type { AttendanceRecord } from "./attendance.js";

/** デモ用の勤怠サンプル(2024-05)。 */
export const SAMPLE_ATTENDANCE: AttendanceRecord[] = [
  { date: "2024-05-01", clockIn: "09:00", clockOut: "18:05" },
  { date: "2024-05-02", clockIn: "08:55", clockOut: "20:10" },
  { date: "2024-05-07", clockIn: "09:10", clockOut: "17:50" },
  { date: "2024-05-08", clockIn: "09:00", clockOut: "19:30" },
  { date: "2024-05-09", clockIn: "09:05", clockOut: "18:00" },
  { date: "2024-05-10", clockIn: "09:00", clockOut: "21:00" },
  { date: "2024-05-13", clockIn: "09:00", clockOut: "18:00", breakMinutes: 45 },
  { date: "2024-05-14", clockIn: "10:00", clockOut: "19:00" },
];
