/**
 * ガントチャートのデータ変換(純関数)。タスク(開始/終了)を、横棒積み上げ用の
 * 「オフセット(透明) + 期間(色付き)」に変換する。
 * @packageDocumentation
 */

/** ガントのタスク入力。 */
export interface GanttTask {
  name: string;
  /** 開始(ミリ秒 or Date)。 */
  start: number | Date;
  /** 終了(ミリ秒 or Date)。 */
  end: number | Date;
  color?: string;
}

/** 変換後の 1 行(recharts 横棒積み上げ用)。 */
export interface GanttRow {
  name: string;
  offset: number;
  duration: number;
  start: number;
  end: number;
  color?: string;
}

const ms = (v: number | Date): number => (v instanceof Date ? v.getTime() : v);

/**
 * タスク配列を、共通の最小時刻を基準としたオフセット+期間に変換する。
 *
 * @param tasks タスクの配列
 * @param range 表示する期間
 */
export function toGanttRows(tasks: GanttTask[]): { rows: GanttRow[]; min: number; max: number } {
  if (tasks.length === 0) return { rows: [], min: 0, max: 0 };
  const starts = tasks.map((t) => ms(t.start));
  const ends = tasks.map((t) => ms(t.end));
  const min = Math.min(...starts);
  const max = Math.max(...ends);
  const rows = tasks.map((t, i) => {
    const s = starts[i]!;
    const e = ends[i]!;
    return { name: t.name, offset: s - min, duration: Math.max(0, e - s), start: s, end: e, color: t.color };
  });
  return { rows, min, max };
}
