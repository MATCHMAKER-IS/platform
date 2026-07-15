/**
 * CSV 取り込み（アプリ側の組み合わせ）。アップロードされた CSV を検証しつつ型付きレコードへ変換する。
 * パースは @platform/csv に委譲する。純粋な組み立てのみ（保存は呼び出し側）。
 * @packageDocumentation
 */
import { parseCsv } from "@platform/csv";
import { normalizeKinds, type Partner } from "./partner-repo.js";
import { type JournalEntry, type JournalLine, type AccountType } from "@platform/accounting";
import { type Product } from "./inventory-repo.js";
import { type AccountDef } from "./account-master-repo.js";

/** 取り込み結果（成功行と行番号つきエラー）。 */
export interface ImportResult<T> {
  rows: T[];
  errors: { line: number; message: string }[];
}

/** CSV を見出し付きのレコード配列にパースする。 */
export function parseCsvRecords(text: string): Record<string, string>[] {
  return parseCsv(text, { header: true }) as Record<string, string>[];
}

const pick = (row: Record<string, string>, keys: string[]): string => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== "") return v.trim();
  }
  return "";
};

/**
 * 取引先マスタの CSV を取り込む。列は「コード/名称/区分/連絡先」（日本語・英語どちらの見出しも許容）。
 * 区分は customer/supplier/payee をカンマ・スラッシュ・全角読点区切りで指定。
 */
export function parsePartnerCsv(text: string): ImportResult<Partner> {
  const records = parseCsvRecords(text);
  const rows: Partner[] = [];
  const errors: { line: number; message: string }[] = [];
  records.forEach((rec, i) => {
    const line = i + 2; // 1 行目は見出し
    const code = pick(rec, ["コード", "code"]);
    const name = pick(rec, ["名称", "name"]);
    const kindsRaw = pick(rec, ["区分", "kinds"]);
    const contact = pick(rec, ["連絡先", "contact"]);
    if (!code || !name) { errors.push({ line, message: "コードと名称は必須です" }); return; }
    const kinds = normalizeKinds(kindsRaw.split(/[,\/、\s]+/).filter(Boolean));
    if (kinds.length === 0) { errors.push({ line, message: `区分が不正です（customer/supplier/payee）: ${kindsRaw}` }); return; }
    const partner: Partner = { code, name, kinds };
    if (contact) partner.contact = contact;
    rows.push(partner);
  });
  return { rows, errors };
}

/**
 * 手動仕訳の CSV を取り込む。列は「日付/摘要/勘定科目/借方/貸方/備考」。
 * 同じ日付＋摘要の連続行を 1 つの仕訳にまとめ、貸借が一致しない仕訳はエラーにする。
 */
export function parseJournalCsv(text: string): ImportResult<JournalEntry> {
  const records = parseCsvRecords(text);
  const errors: { line: number; message: string }[] = [];
  // (日付, 摘要) ごとに行を束ねる
  const groups: { key: string; date: string; description: string; lines: JournalLine[]; firstLine: number }[] = [];
  let last: { key: string } | undefined;
  records.forEach((rec, i) => {
    const line = i + 2;
    const date = pick(rec, ["日付", "date"]);
    const description = pick(rec, ["摘要", "description"]);
    const account = pick(rec, ["勘定科目", "account"]);
    const debit = Number(pick(rec, ["借方", "debit"]) || "0");
    const credit = Number(pick(rec, ["貸方", "credit"]) || "0");
    const memo = pick(rec, ["備考", "memo"]);
    if (!date || !account) { errors.push({ line, message: "日付と勘定科目は必須です" }); return; }
    if (Number.isNaN(debit) || Number.isNaN(credit)) { errors.push({ line, message: "借方・貸方は数値で入力してください" }); return; }
    const key = `${date}\u0000${description}`;
    let group = last && last.key === key ? groups[groups.length - 1] : groups.find((g) => g.key === key);
    if (!group) { group = { key, date, description, lines: [], firstLine: line }; groups.push(group); }
    group.lines.push({ account, debit, credit, ...(memo ? { memo } : {}) });
    last = { key };
  });
  const rows: JournalEntry[] = [];
  for (const g of groups) {
    const debitTotal = g.lines.reduce((s, l) => s + l.debit, 0);
    const creditTotal = g.lines.reduce((s, l) => s + l.credit, 0);
    if (debitTotal !== creditTotal) { errors.push({ line: g.firstLine, message: `仕訳の貸借が一致しません（借方${debitTotal} / 貸方${creditTotal}）: ${g.description}` }); continue; }
    rows.push({ date: g.date, description: g.description, lines: g.lines });
  }
  return { rows, errors };
}

const ACCOUNT_TYPES: AccountType[] = ["asset", "liability", "equity", "revenue", "expense"];

/** 商品マスタ CSV を Product[] にパースする（sku・名称・単位）。 */
export function parseProductCsv(text: string): ImportResult<Product> {
  const records = parseCsvRecords(text);
  const rows: Product[] = [];
  const errors: { line: number; message: string }[] = [];
  const seen = new Set<string>();
  records.forEach((rec, i) => {
    const line = i + 2;
    const sku = pick(rec, ["SKU", "sku", "コード"]);
    const name = pick(rec, ["名称", "name", "商品名"]);
    const unit = pick(rec, ["単位", "unit"]) || "個";
    if (!sku || !name) { errors.push({ line, message: "SKU と名称は必須です" }); return; }
    if (seen.has(sku)) { errors.push({ line, message: `SKU が重複しています: ${sku}` }); return; }
    seen.add(sku);
    rows.push({ sku, name, unit });
  });
  return { rows, errors };
}

/** 勘定科目 CSV を AccountDef[] にパースする（科目名・区分）。 */
export function parseAccountCsv(text: string): ImportResult<AccountDef> {
  const records = parseCsvRecords(text);
  const rows: AccountDef[] = [];
  const errors: { line: number; message: string }[] = [];
  const seen = new Set<string>();
  records.forEach((rec, i) => {
    const line = i + 2;
    const account = pick(rec, ["科目", "account", "勘定科目"]);
    const typeRaw = pick(rec, ["区分", "type"]).toLowerCase();
    if (!account) { errors.push({ line, message: "科目は必須です" }); return; }
    if (!ACCOUNT_TYPES.includes(typeRaw as AccountType)) { errors.push({ line, message: `区分が不正です（asset/liability/equity/revenue/expense）: ${typeRaw}` }); return; }
    if (seen.has(account)) { errors.push({ line, message: `科目が重複しています: ${account}` }); return; }
    seen.add(account);
    rows.push({ account, type: typeRaw as AccountType });
  });
  return { rows, errors };
}
