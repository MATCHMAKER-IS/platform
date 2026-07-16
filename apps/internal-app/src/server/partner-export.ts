/**
 * 取引先マスタの CSV 書き出し（アプリ側の組み合わせ）。CSV 化は @platform/csv に委譲する。
 * @packageDocumentation
 */
import { toCsv } from "@platform/csv";
import { type Partner, type PartnerKind } from "./partner-repo";

const KIND_LABEL: Record<PartnerKind, string> = { customer: "customer", supplier: "supplier", payee: "payee" };

const PARTNER_COLUMNS = [
  { key: "code", header: "コード" },
  { key: "name", header: "名称" },
  { key: "kinds", header: "区分" },
  { key: "contact", header: "連絡先" },
];

/** 取引先一覧を CSV（Excel 互換・BOM 付き）に変換する。区分はカンマ区切りで出力。 */
export function partnersCsv(partners: Partner[]): string {
  const rows = partners.map((p) => ({ code: p.code, name: p.name, kinds: p.kinds.map((k) => KIND_LABEL[k]).join(","), contact: p.contact ?? "" }));
  return toCsv(rows, { columns: PARTNER_COLUMNS, bom: true });
}
