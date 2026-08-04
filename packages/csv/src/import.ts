/**
 * CSV 取り込みの支援（文字コードの判定・型変換・エラー行の扱い）。
 *
 * `index.ts` の `parseCsv` は**テキストを行と列に分ける**ところまで。
 * 実際の取り込みでは、その手前と後ろで問題が起きる:
 *
 *   - **手前**: 相手がくれるファイルが Shift_JIS。UTF-8 として読むと文字化けする
 *   - **後ろ**: 「1,000」「1000円」「２０２６/８/３」を数値や日付に直す必要がある
 *
 * 【最も多い事故：1 行の誤りで全部止まる】
 * 1,000 行のうち 3 行が不正なとき、例外を投げて止めると
 * **997 行の正しいデータも取り込めない**。かといって黙って飛ばすと、
 * 「取り込んだつもりが入っていない」ことになる。
 *
 * ここでは**成功した行と失敗した行を両方返す**。
 * 呼び出し側が「997 行を取り込み、3 行は要確認」と示せる。
 *
 * 【import の仕方】
 * **`@platform/csv/import` から取る**（バレルには入れていない）。
 * 書き出しだけ使う画面が多く、取り込みの一式まで読み込ませたくないため。
 *
 * ```ts
 * import { detectEncoding, importRows } from "@platform/csv/import";
 * ```
 *
 * @packageDocumentation
 */

/** 想定する文字コード。 */
export type Encoding = "utf-8" | "shift_jis" | "utf-16le";

/**
 * バイト列から文字コードを推定する。
 *
 * **日本の業務では Shift_JIS の CSV が今も主流**（会計ソフト・銀行の明細など）。
 * UTF-8 として読むと文字化けし、「データが壊れている」と誤解される。
 *
 * 判定の順序:
 *   1. **BOM があればそれに従う**（最も確実）
 *   2. UTF-8 として妥当なバイト列か
 *   3. それ以外は Shift_JIS とみなす
 *
 * @param bytes ファイルの先頭（**全部でなくてよい**。数 KB あれば足りる）
 * @returns 推定した文字コード
 *
 * @example
 * ```ts
 * const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
 * const encoding = detectEncoding(head);
 * const text = new TextDecoder(encoding).decode(await file.arrayBuffer());
 * ```
 */
export function detectEncoding(bytes: Uint8Array): Encoding {
  // ── BOM を見る（最も確実）──
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8";
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";

  // ── UTF-8 として妥当か ──
  // 妥当なら UTF-8、破綻したら Shift_JIS とみなす
  let i = 0;
  let hasMultiByte = false;
  while (i < bytes.length) {
    const b = bytes[i]!;
    if (b < 0x80) { i += 1; continue; }

    let len: number;
    if ((b & 0xe0) === 0xc0) len = 2;
    else if ((b & 0xf0) === 0xe0) len = 3;
    else if ((b & 0xf8) === 0xf0) len = 4;
    else return "shift_jis"; // 先頭バイトとして不正

    // 末尾で切れている場合は判断を保留（**切れ目で誤判定しない**）
    if (i + len > bytes.length) break;
    for (let k = 1; k < len; k += 1) {
      if ((bytes[i + k]! & 0xc0) !== 0x80) return "shift_jis";
    }
    hasMultiByte = true;
    i += len;
  }
  // ASCII だけなら UTF-8 として扱って問題ない
  return hasMultiByte || i >= bytes.length ? "utf-8" : "utf-8";
}

/** 列の型。 */
export type ColumnType = "string" | "number" | "integer" | "date" | "boolean";

/** 列の定義。 */
export interface ColumnSpec {
  /** CSV の見出し（**表記ゆれは `aliases` で吸収する**）。 */
  header: string;
  /** 取り込んだ後の項目名。 */
  field: string;
  /** 型。 */
  type: ColumnType;
  /** 必須か（**空だとエラー行になる**）。 */
  required?: boolean;
  /**
   * 見出しの別名。
   *
   * 相手によって「金額」「額」「amount」など表記が違う。
   * **毎回テンプレートを送り直すより、こちらで吸収する方が早い**。
   */
  aliases?: string[];
}

/** 取り込みに失敗した行。 */
export interface RowError {
  /** 行番号（**1 始まり・見出し行を含む**）。画面に出すときはこの番号で示す。 */
  line: number;
  /** どの列か。 */
  field?: string;
  /** 何が問題か。 */
  message: string;
  /** その行の生の値（**確認用**）。 */
  raw: Record<string, string>;
}

/** 取り込みの結果。 */
export interface ImportResult<T> {
  /** 取り込めた行。 */
  rows: T[];
  /** **取り込めなかった行**（黙って飛ばさない）。 */
  errors: RowError[];
  /** 見つからなかった列（**見出しの表記ゆれ**）。 */
  missingColumns: string[];
  /** 定義に無い列（**無視した**ことを伝える）。 */
  unknownColumns: string[];
}

/** 全角数字を半角に直す。 */
function toHalfWidthDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/**
 * 値を型に合わせて変換する。
 *
 * **人が手で作った CSV は表記が揺れる**。「1,000」「1000円」「¥1,000」は
 * どれも 1000 として扱えないと、取り込みのたびに手直しが要る。
 *
 * @param value 生の値
 * @param type 変換先の型
 * @returns 変換した値。**変換できなければ `undefined`**
 */
export function coerceValue(value: string, type: ColumnType): unknown {
  const v = value.trim();
  if (v === "") return undefined;

  switch (type) {
    case "string":
      return v;

    case "number":
    case "integer": {
      // **カンマ・通貨記号・全角数字を吸収する**
      const cleaned = toHalfWidthDigits(v)
        .replace(/[,，\s]/g, "")
        .replace(/^[¥￥$]/, "")
        .replace(/円$/, "");
      // **括弧は負の数**（会計ソフトの出力によくある形）
      const negated = /^\(.*\)$/.test(cleaned) ? `-${cleaned.slice(1, -1)}` : cleaned;
      const n = Number(negated);
      if (!Number.isFinite(n)) return undefined;
      if (type === "integer" && !Number.isInteger(n)) return undefined;
      return n;
    }

    case "date": {
      // **区切りは / . - のどれでもよい**。全角も受ける
      const normalized = toHalfWidthDigits(v).replace(/[./]/g, "-").replace(/[年月]/g, "-").replace(/日$/, "");
      const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalized);
      if (m === null) return undefined;
      const [, y, mo, d] = m;
      const month = Number(mo);
      const day = Number(d);
      if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
      // **YYYY-MM-DD に揃える**（0 埋め）
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    case "boolean": {
      const lower = v.toLowerCase();
      if (["true", "1", "yes", "y", "○", "はい", "有"].includes(lower)) return true;
      if (["false", "0", "no", "n", "×", "いいえ", "無"].includes(lower)) return false;
      return undefined;
    }
  }
}

/**
 * CSV の行を型付きの値に変換する。
 *
 * **1 行の誤りで全部を止めない**。成功した行と失敗した行を両方返すので、
 * 「997 行を取り込み、3 行は要確認」と示せる。
 *
 * 見出しの表記ゆれは `aliases` で吸収する。
 * **毎回テンプレートを送り直すより、こちらで吸収する方が早い**。
 *
 * @param rows `parseCsv` の結果（**見出し付きのオブジェクト配列**）
 * @param columns 列の定義
 * @returns 取り込めた行と、失敗した行
 *
 * @example
 * ```ts
 * const parsed = parseCsv(text, { header: true }) as Record<string, string>[];
 * const result = importRows(parsed, [
 *   { header: "日付", field: "date", type: "date", required: true },
 *   { header: "金額", field: "amount", type: "number", required: true, aliases: ["額", "amount"] },
 * ]);
 * console.log(`${result.rows.length} 件を取り込み、${result.errors.length} 件は要確認`);
 * ```
 */
export function importRows<T extends Record<string, unknown>>(
  rows: readonly Record<string, string>[],
  columns: readonly ColumnSpec[],
): ImportResult<T> {
  const out: T[] = [];
  const errors: RowError[] = [];

  const headers = rows.length > 0 ? Object.keys(rows[0]!) : [];

  // 見出しを解決する（別名も見る）
  const resolved = new Map<string, string>();
  const missingColumns: string[] = [];
  for (const c of columns) {
    const candidates = [c.header, ...(c.aliases ?? [])];
    const hit = headers.find((h) => candidates.some((cand) => h.trim() === cand));
    if (hit === undefined) missingColumns.push(c.header);
    else resolved.set(c.field, hit);
  }

  const known = new Set(resolved.values());
  const unknownColumns = headers.filter((h) => !known.has(h) && h.trim() !== "");

  for (const [index, raw] of rows.entries()) {
    // **見出し行を 1 行目として数える**（画面で「3 行目」と言われて探せるように）
    const line = index + 2;
    const record: Record<string, unknown> = {};
    let failed = false;

    for (const c of columns) {
      const header = resolved.get(c.field);
      const value = header === undefined ? "" : (raw[header] ?? "");
      const coerced = coerceValue(value, c.type);

      if (coerced === undefined) {
        if (c.required === true) {
          errors.push({
            line, field: c.field, raw,
            message: value.trim() === ""
              ? `「${c.header}」が空です`
              : `「${c.header}」を${c.type === "date" ? "日付" : c.type === "number" || c.type === "integer" ? "数値" : "値"}として読めません（${value}）`,
          });
          failed = true;
        }
        continue;
      }
      record[c.field] = coerced;
    }

    // **エラーがあった行は取り込まない**（半端なデータを入れない）
    if (!failed) out.push(record as T);
  }

  return { rows: out, errors, missingColumns, unknownColumns };
}

/**
 * 失敗した行だけの CSV を作る。
 *
 * **直して再取り込みできる形**にする。エラーの内容を先頭列に足すので、
 * 「何が悪かったか」を見ながら直せる。
 *
 * 画面にエラー一覧を出すだけだと、100 件あったときに手作業で直すことになる。
 *
 * @param errors 失敗した行
 * @param headers 元の CSV の見出し
 * @returns CSV のテキスト（**エラー内容の列を先頭に足す**）
 *
 * @example
 * ```ts
 * const csv = errorRowsToCsv(result.errors, ["日付", "金額", "摘要"]);
 * // ダウンロードさせて、直してもらってから再取り込み
 * ```
 */
export function errorRowsToCsv(
  errors: readonly RowError[],
  headers: readonly string[],
): string {
  // 同じ行に複数のエラーがあればまとめる
  const byLine = new Map<number, { raw: Record<string, string>; messages: string[] }>();
  for (const e of errors) {
    const cur = byLine.get(e.line);
    if (cur === undefined) byLine.set(e.line, { raw: e.raw, messages: [e.message] });
    else cur.messages.push(e.message);
  }

  const escape = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines: string[] = [
    ["エラー内容", "元の行番号", ...headers].map(escape).join(","),
  ];
  for (const [line, { raw, messages }] of [...byLine].sort((a, b) => a[0] - b[0])) {
    lines.push([
      escape(messages.join(" / ")),
      String(line),
      ...headers.map((h) => escape(raw[h] ?? "")),
    ].join(","));
  }
  return lines.join("\n");
}
