/**
 * 問い合わせを Excel でダウンロード。
 * - @platform/auth の RBAC で "inquiry:export" 権限を確認(デモは admin 固定)
 * - @platform/xlsx で .xlsx を生成
 */
import { handleRoute } from "@platform/http";
import { assertCan } from "@platform/auth";
import { writeSheet } from "@platform/xlsx";
import { formatJst } from "@platform/datetime";
import { listInquiries, policy } from "../../../../server/store";

export const GET = handleRoute(async () => {
  // デモのため admin ユーザー固定。実アプリではセッションから取得する。
  assertCan(policy, { id: "demo-admin", roles: ["admin"] }, "inquiry:export");

  const rows = listInquiries().map((i) => ({
    氏名: i.name,
    メール: i.email,
    本文: i.message,
    受付日時: formatJst(new Date(i.createdAt)),
  }));
  const out = await writeSheet(rows.length ? rows : [{ 氏名: "", メール: "", 本文: "", 受付日時: "" }], {
    sheetName: "問い合わせ",
  });
  if (!out.ok) throw out.error;

  // Uint8Array<ArrayBufferLike> は BodyInit に代入できない(TS 5.9 で型が厳格化)。
  // ArrayBuffer に取り出して渡す。
  const body = out.value.buffer.slice(out.value.byteOffset, out.value.byteOffset + out.value.byteLength) as ArrayBuffer;
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="inquiries.xlsx"',
    },
  });
});
