// public-api: デモ用の問い合わせ受付(公開フォームの例)
/**
 * 問い合わせ API。基盤の使い方を 1 ルートで示す:
 * - @platform/validation で入力検証
 * - @platform/http の handleRoute で AppError→HTTP 変換
 * - @platform/datetime で JST 表示用の受付時刻
 * - @platform/mail(メモリ)で確認メール送信
 */
import { handleRoute } from "@platform/http";
import { validate, z, email } from "@platform/validation";
import { formatJst } from "@platform/datetime";
import { listInquiries, addInquiry, mailer } from "../../../server/store";

const InquirySchema = z.object({
  name: z.string().min(1, "氏名は必須です"),
  email,
  message: z.string().min(5, "本文は5文字以上で入力してください"),
});

export const GET = handleRoute(async () => {
  const rows = listInquiries().map((i) => ({ ...i, createdAtJst: formatJst(new Date(i.createdAt)) }));
  return Response.json({ inquiries: rows });
});

export const POST = handleRoute(async (req: Request) => {
  const parsed = validate(InquirySchema, await req.json());
  if (!parsed.ok) throw parsed.error; // 自動で 400 + エラーボディ

  const now = new Date();
  const inquiry = {
    id: crypto.randomUUID(),
    ...parsed.value,
    createdAt: now.toISOString(),
  };
  addInquiry(inquiry);

  // 確認メール(メモリ Transport に記録される)
  await mailer.sendMail({
    to: inquiry.email,
    subject: "お問い合わせを受け付けました",
    text: `${inquiry.name} 様\n\n受付日時: ${formatJst(now)}\n内容: ${inquiry.message}`,
  });

  return Response.json({ ok: true, id: inquiry.id, receivedAt: formatJst(now) }, { status: 201 });
});
