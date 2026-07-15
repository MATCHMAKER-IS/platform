/**
 * シートUIのセル選択・コピー(TSV)の純ロジック。
 * @packageDocumentation
 */

/** セル位置(行・列インデックス)。 */
export interface CellPos { row: number; col: number }

/** 選択矩形(行列の範囲)。 */
export interface CellRange { r0: number; c0: number; r1: number; c1: number }

/** アンカーとフォーカスから正規化した選択範囲を作る。 */
export function normalizeCellRange(anchor: CellPos, focus: CellPos): CellRange {
  return {
    r0: Math.min(anchor.row, focus.row),
    c0: Math.min(anchor.col, focus.col),
    r1: Math.max(anchor.row, focus.row),
    c1: Math.max(anchor.col, focus.col),
  };
}

/** セルが範囲内か。 */
export function inRange(range: CellRange, row: number, col: number): boolean {
  return row >= range.r0 && row <= range.r1 && col >= range.c0 && col <= range.c1;
}

/** 選択範囲を TSV(タブ区切り)に変換する。Excel に貼り付け可能。 */
export function rangeToTsv<T extends Record<string, unknown>>(rows: T[], columnKeys: string[], range: CellRange): string {
  const lines: string[] = [];
  for (let r = range.r0; r <= range.r1; r++) {
    const cells: string[] = [];
    for (let c = range.c0; c <= range.c1; c++) {
      const key = columnKeys[c];
      const v = key != null ? rows[r]?.[key] : undefined;
      cells.push(v == null ? "" : String(v));
    }
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}

/** 固定列の左端オフセット(px)を、各列幅から算出する。 */
export function stickyLeftOffsets(widths: number[], stickyCount: number): number[] {
  const offsets: number[] = [];
  let acc = 0;
  for (let i = 0; i < stickyCount; i++) {
    offsets.push(acc);
    acc += widths[i] ?? 0;
  }
  return offsets;
}

/** 指定列の幅を delta 分変更する(最小幅でクランプ)。 */
export function applyColumnResize(widths: number[], index: number, delta: number, min = 48): number[] {
  const next = [...widths];
  next[index] = Math.max(min, (next[index] ?? 120) + delta);
  return next;
}

/** 仮想化: スクロール位置から描画すべき行範囲と上下パディングを求める。 */
export function computeVisibleRange(
  scrollTop: number, rowHeight: number, viewportHeight: number, total: number, overscan = 6,
): { start: number; end: number; topPad: number; bottomPad: number } {
  if (rowHeight <= 0) return { start: 0, end: total, topPad: 0, bottomPad: 0 };
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visible = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const end = Math.min(total, start + visible);
  return { start, end, topPad: start * rowHeight, bottomPad: Math.max(0, (total - end) * rowHeight) };
}

/** TSV(タブ区切り)を 2 次元配列にパースする。 */
export function parseTsv(text: string): string[][] {
  const t = text.replace(/\r\n/g, "\n").replace(/\n+$/, "");
  if (t === "") return [];
  return t.split("\n").map((line) => line.split("\t"));
}

/**
 * TSV を行オブジェクトに変換する(Excel からの貼り付け取り込み)。
 * header:true なら 1 行目を見出しキーに使う。それ以外は keys を位置で対応させる。
 */
export function tsvToRows(text: string, keys: string[], options: { header?: boolean } = {}): Record<string, string>[] {
  const matrix = parseTsv(text);
  if (matrix.length === 0) return [];
  const headerKeys = options.header ? matrix[0]! : keys;
  const dataRows = options.header ? matrix.slice(1) : matrix;
  return dataRows.map((cells) => {
    const o: Record<string, string> = {};
    headerKeys.forEach((k, i) => { o[k] = cells[i] ?? ""; });
    return o;
  });
}

/** 横仮想化: スクロール位置から描画する非固定列の範囲と左右パディングを求める。 */
export function computeVisibleColumns(
  scrollLeft: number, widths: number[], viewportWidth: number, freezeLeft: number, overscan = 2,
): { start: number; end: number; leftPad: number; rightPad: number } {
  const n = widths.length;
  const lefts: number[] = [0];
  for (let i = 0; i < n; i++) lefts.push(lefts[i]! + widths[i]!);
  const total = lefts[n]!;
  const frozenWidth = lefts[freezeLeft] ?? 0;
  if (freezeLeft >= n) return { start: n, end: n - 1, leftPad: 0, rightPad: 0 };

  const viewL = scrollLeft + frozenWidth;
  const viewR = scrollLeft + viewportWidth;
  let start = freezeLeft;
  while (start < n && lefts[start + 1]! <= viewL) start++;
  let end = start;
  while (end + 1 < n && lefts[end + 1]! < viewR) end++;
  start = Math.max(freezeLeft, start - overscan);
  end = Math.min(n - 1, end + overscan);

  const leftPad = (lefts[start] ?? total) - (lefts[freezeLeft] ?? 0);
  const rightPad = total - (lefts[end + 1] ?? total);
  return { start, end, leftPad, rightPad };
}
