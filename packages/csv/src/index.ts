/**
 * `@platform/csv` — CSV の生成・解析・ダウンロード。
 *
 * 生成/解析は純関数(サーバ・クライアント両方で使える)。`downloadCsv` はブラウザ専用。
 * Excel で日本語が文字化けしないよう、ダウンロード時は既定で BOM を付ける。
 *
 * @packageDocumentation
 */

/** CSV 生成の列指定。 */
export interface CsvColumn {
  /** 行オブジェクトのキー。 */
  key: string;
  /** ヘッダ表示名(既定はキー)。 */
  header?: string;
}

/** {@link toCsv} のオプション。 */
export interface ToCsvOptions {
  /** 出力する列(未指定なら最初の行のキー順)。 */
  columns?: CsvColumn[];
  /** 区切り文字(既定 ","、TSV なら "\t")。 */
  delimiter?: string;
  /** 改行(既定 "\r\n")。 */
  eol?: string;
  /** 先頭に BOM を付ける(既定 false。Excel 用は downloadCsv が付与)。 */
  bom?: boolean;
  /** ヘッダ行を出力する(既定 true)。 */
  header?: boolean;
}

/**
 * 1 値を CSV フィールドとしてエスケープする。
 *
 *
 * @param value 値
 * @returns エスケープした文字列(**カンマ・改行・引用符を含むなら引用符で囲む**)
 */
export function csvEscape(value: unknown, delimiter = ","): string {
  if (value == null) return "";
  const s = value instanceof Date ? value.toISOString() : String(value);
  return /["\r\n]|<DELIM>/.test(s.replace(new RegExp(delimiter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "<DELIM>"))
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

/**
 * オブジェクト配列を CSV 文字列にする。
 * @example
 * ```ts
 * toCsv([{ name: "山田", note: "a,b" }], { columns: [{ key: "name", header: "氏名" }, { key: "note", header: "備考" }] });
 * // 氏名,備考\r\n山田,"a,b"
 * ```
 *
 * @param rows 行の配列
 * @param options.columns 出力する列(**省略すると最初の行のキー**)
 * @param options.bom BOM を付けるか(**Excel で開くなら必須**。無いと日本語が文字化けする)
 * @returns CSV 文字列
 */
export function toCsv(rows: Record<string, unknown>[], options: ToCsvOptions = {}): string {
  const { delimiter = ",", eol = "\r\n", bom = false, header = true } = options;
  const columns: CsvColumn[] = options.columns ?? Object.keys(rows[0] ?? {}).map((key) => ({ key }));
  const esc = (v: unknown) => csvEscape(v, delimiter);
  const lines: string[] = [];
  if (header) lines.push(columns.map((c) => esc(c.header ?? c.key)).join(delimiter));
  for (const row of rows) lines.push(columns.map((c) => esc(row[c.key])).join(delimiter));
  return (bom ? "\uFEFF" : "") + lines.join(eol);
}

/** {@link parseCsv} のオプション。 */
export interface ParseCsvOptions {
  delimiter?: string;
  /** 1 行目をヘッダとして扱い、オブジェクト配列で返す。 */
  header?: boolean;
}

/**
 * CSV 文字列を解析する(引用符・埋め込み改行・エスケープ対応)。
 * @returns header:true ならオブジェクト配列、false なら string[][]。
 * @param text CSV 文字列
 * @param options.header ヘッダ行があるか
 */
export function parseCsv(text: string, options: ParseCsvOptions = {}): string[][] | Record<string, string>[] {
  const delimiter = options.delimiter ?? ",";
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // BOM 除去
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); field = ""; row = []; }
    else if (c === "\r") { /* skip, handled by \n */ }
    else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }

  if (!options.header) return rows;
  const [head, ...body] = rows;
  const keys = head ?? [];
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""])));
}

/**
 * CSV をブラウザでダウンロードする(BOM 既定で付与=Excel 対策)。
 * @param filename 例 "export.csv"
 * @param rows 行データ
 */
export function downloadCsv(filename: string, rows: Record<string, unknown>[], options: ToCsvOptions = {}): void {
  if (typeof document === "undefined") return;
  const csv = toCsv(rows, { bom: true, ...options });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─────────────────────── ストリーミング/チャンク処理 ───────────────────────
// 出典: 社内 zoho-emergency-backup の CSV ストリーミング設計を、ブラウザ(File/Papaparse)非依存の
// 汎用形に一般化して取り込み。大容量 CSV をメモリに全展開せず、チャンク単位で処理する。

/** チャンク処理の進捗。 */
export interface CsvChunkProgress {
  /** これまでに読んだ行数(ヘッダ除く)。 */
  rowsSoFar: number;
  /** これまでに読んだチャンク数。 */
  chunkIndex: number;
}

/** チャンクごとのハンドラ。オブジェクト配列(ヘッダをキーに)で受け取る。 */
export type CsvChunkHandler = (rows: Record<string, string>[], progress: CsvChunkProgress) => Promise<void> | void;

/** ストリーミングパースのオプション。 */
export interface CsvStreamOptions {
  delimiter?: string;
  /** 1 チャンクの行数(既定 1000)。 */
  chunkSize?: number;
  /** ヘッダ確定時に一度だけ呼ばれる。 */
  onHeader?: (columns: string[]) => void;
}

/** ストリーミングパースの結果サマリ。 */
export interface CsvStreamResult {
  columns: string[];
  totalRows: number;
  chunks: number;
}

/**
 * 行(文字列)を非同期に供給するソース。ファイル読み込み・ネットワーク・メモリのいずれでも実装できる。
 * 1 要素が「1 論理行の生テキスト(改行なし)」であることを前提とする。
 * 埋め込み改行を含む CSV には {@link parseCsvChunks}(テキスト分割)を使う。
 */
export type CsvLineSource = AsyncIterable<string> | Iterable<string>;

/**
 * 行ソースをチャンク単位で処理する(環境非依存)。ヘッダは先頭行から自動検出。
 * メモリには最大 chunkSize 行しか載らないため、巨大データでも安全に流せる。
 *
 * @example
 * ```ts
 * await streamCsvLines(fileLineIterator, {
 *   chunkSize: 500,
 *   onHeader: (cols) => console.log(cols),
 * }, async (rows, { rowsSoFar }) => {
 *   await db.bulkInsert(rows);   // チャンクごとに保存
 * });
 * ```
 *
 * @param stream 読み込むストリーム
 * @returns 行を 1 つずつ返す非同期イテレータ(**全部メモリに載せない**。大きなファイルでも扱える)
 */
export async function streamCsvLines(source: CsvLineSource, options: CsvStreamOptions, onChunk: CsvChunkHandler): Promise<CsvStreamResult> {
  const delimiter = options.delimiter ?? ",";
  const chunkSize = options.chunkSize ?? 1000;
  const splitLine = (line: string): string[] => {
    const parsed = parseCsv(line, { delimiter }) as string[][];
    return parsed[0] ?? [];
  };

  let columns: string[] | null = null;
  let buffer: Record<string, string>[] = [];
  let rowsSoFar = 0;
  let chunkIndex = 0;

  const flush = async (): Promise<void> => {
    if (buffer.length === 0) return;
    const current = buffer;
    buffer = [];
    await onChunk(current, { rowsSoFar, chunkIndex });
    chunkIndex += 1;
  };

  for await (const rawLine of source as AsyncIterable<string>) {
    if (rawLine === "") continue;
    const fields = splitLine(rawLine);
    if (columns === null) {
      columns = fields;
      options.onHeader?.(columns);
      continue;
    }
    const cols = columns;
    buffer.push(Object.fromEntries(cols.map((k, i) => [k, fields[i] ?? ""])));
    rowsSoFar += 1;
    if (buffer.length >= chunkSize) await flush();
  }
  await flush();
  return { columns: columns ?? [], totalRows: rowsSoFar, chunks: chunkIndex };
}

/**
 * CSV テキスト全体(埋め込み改行対応)をチャンクに分けて処理する。
 * テキストは一度パースするためメモリに載るが、下流処理(DB 書き込み等)をチャンク化して
 * 一括処理の負荷を平準化したいときに使う。行の生成は {@link parseCsv} に委譲。
 *
 * @param stream 読み込むストリーム
 * @param options.chunkSize 1 塊の行数
 * @returns 塊ごとに返す非同期イテレータ(**まとめて DB に入れる**のに使う)
 */
export async function parseCsvChunks(text: string, options: CsvStreamOptions, onChunk: CsvChunkHandler): Promise<CsvStreamResult> {
  const objects = parseCsv(text, { delimiter: options.delimiter ?? ",", header: true }) as Record<string, string>[];
  const columns = objects.length > 0 ? Object.keys(objects[0] ?? {}) : [];
  if (columns.length > 0) options.onHeader?.(columns);
  const chunkSize = options.chunkSize ?? 1000;
  let chunkIndex = 0;
  let rowsSoFar = 0;
  for (let i = 0; i < objects.length; i += chunkSize) {
    const slice = objects.slice(i, i + chunkSize);
    rowsSoFar += slice.length;
    await onChunk(slice, { rowsSoFar, chunkIndex });
    chunkIndex += 1;
  }
  return { columns, totalRows: objects.length, chunks: chunkIndex };
}

