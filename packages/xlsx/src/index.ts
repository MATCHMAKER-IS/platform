/**
 * `@platform/xlsx` — Excel(.xlsx)の読み書き。
 *
 * 「Excel からの取り込み」「Excel への出力」を共通化する(日本の業務アプリで頻出)。
 * 内部実装は ExcelJS。アプリは行=オブジェクトの配列として扱えばよい。
 *
 * @packageDocumentation
 */

import ExcelJS from "exceljs";
import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";

/** 1 行を表すオブジェクト(ヘッダ名 → セル値)。 */
export type Row = Record<string, string | number | boolean | Date | null>;

/**
 * .xlsx バッファを読み、先頭シートを「ヘッダ付きの行配列」として返す。
 * 1 行目をヘッダとして扱う。
 *
 * @param buffer .xlsx のバイナリ
 * @param sheetName 対象シート名(省略時は先頭シート)
 * @returns 行オブジェクトの配列
 *
 * @example
 * ```ts
 * const res = await readSheet(uploadedBytes);
 * if (res.ok) for (const row of res.value) console.log(row["氏名"], row["金額"]);
 * ```
 * @throws ファイルが壊れている・対応しない形式の場合
 */
export async function readSheet(
  buffer: ArrayBuffer | Uint8Array,
  sheetName?: string,
): Promise<Result<Row[]>> {
  return tryCatch(async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as ArrayBuffer);
    const ws = sheetName ? wb.getWorksheet(sheetName) : wb.worksheets[0];
    if (!ws) throw new AppError(ErrorCode.NOT_FOUND, "対象シートが見つかりません");

    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, col) => {
      headers[col] = String(cell.value ?? `col${col}`);
    });

    const rows: Row[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // ヘッダ行はスキップ
      const obj: Row = {};
      row.eachCell((cell, col) => {
        const key = headers[col];
        if (key) obj[key] = cell.value as Row[string];
      });
      rows.push(obj);
    });
    return rows;
  }).then((r) =>
    r.ok
      ? r
      : {
          ok: false as const,
          error:
            r.error.code === ErrorCode.NOT_FOUND
              ? r.error
              : new AppError(ErrorCode.VALIDATION, "Excelの読み込みに失敗しました", { cause: r.error }),
        },
  );
}

/** {@link writeSheet} のオプション。 */
export interface WriteOptions {
  /** シート名(既定: "Sheet1")。 */
  sheetName?: string;
  /** 列の順序を固定したい場合のヘッダ順(省略時は最初の行のキー順)。 */
  headers?: string[];
}

/**
 * 行配列を .xlsx バッファに書き出す。1 行目にヘッダを付ける。
 *
 * @param rows 出力する行
 * @param options シート名・ヘッダ順
 * @returns .xlsx のバイナリ(ダウンロードや storage への保存に使う)
 *
 * @example
 * ```ts
 * const res = await writeSheet([{ 氏名: "山田", 金額: 1000 }]);
 * if (res.ok) await storage.put("export.xlsx", res.value);
 * ```
 */
export async function writeSheet(
  rows: Row[],
  options: WriteOptions = {},
): Promise<Result<Uint8Array>> {
  return tryCatch(async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(options.sheetName ?? "Sheet1");
    const headers = options.headers ?? (rows[0] ? Object.keys(rows[0]) : []);
    ws.addRow(headers);
    for (const row of rows) {
      ws.addRow(headers.map((h) => row[h] ?? null));
    }
    const buf = await wb.xlsx.writeBuffer();
    return new Uint8Array(buf as ArrayBuffer);
  }).then((r) =>
    r.ok ? r : { ok: false as const, error: new AppError(ErrorCode.INTERNAL, "Excelの書き出しに失敗しました", { cause: r.error }) },
  );
}

/** {@link writeWorkbook} の 1 シート。 */
export interface SheetInput {
  name: string;
  rows: Row[];
  headers?: string[];
  /** 先頭行(ヘッダ)を固定表示する。 */
  freezeHeader?: boolean;
}

/**
 * 複数シートの .xlsx を書き出す(月次レポート等)。
 * @example
 * ```ts
 * const res = await writeWorkbook([
 *   { name: "サマリ", rows: summaryRows, freezeHeader: true },
 *   { name: "科目別", rows: categoryRows },
 * ]);
 * ```
 *
 * @param sheets シートの配列
 * @returns xlsx のバイト列(**日付は Excel のシリアル値に変換される**)
 */
export async function writeWorkbook(sheets: SheetInput[]): Promise<Result<Uint8Array>> {
  return tryCatch(async () => {
    const wb = new ExcelJS.Workbook();
    for (const sheet of sheets) {
      const ws = wb.addWorksheet(sheet.name);
      const headers = sheet.headers ?? (sheet.rows[0] ? Object.keys(sheet.rows[0]) : []);
      ws.addRow(headers);
      for (const row of sheet.rows) ws.addRow(headers.map((h) => row[h] ?? null));
      if (sheet.freezeHeader) ws.views = [{ state: "frozen", ySplit: 1 }];
    }
    const buf = await wb.xlsx.writeBuffer();
    return new Uint8Array(buf as ArrayBuffer);
  }).then((r) =>
    r.ok ? r : { ok: false as const, error: new AppError(ErrorCode.INTERNAL, "Excelの書き出しに失敗しました", { cause: r.error }) },
  );
}
