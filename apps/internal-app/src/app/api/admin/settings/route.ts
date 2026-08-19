/** 管理: システム設定 取得(GET)・更新(POST)。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument";
import { validate, z } from "@platform/validation";

/**
 * システム設定の上書き（すべて任意）。
 *
 * **数値は `settings-repo.ts` の `clampMonth` / `clampRate` が範囲を守る**ので、
 * ここで見るのは**文字列の形**である。
 *
 * 特に Webhook URL が重要で、`as Record<string, string>` のままだと
 * **`javascript:` や社内の別サービスを指す URL がそのまま保存され**、
 * 監査アラートの送信先として使われる（SSRF の入口になる）。
 */
const SettingsPatch = z.object({
  companyName: z.string().max(100).optional(),
  fiscalClosingMonth: z.coerce.number().optional(),
  consumptionTaxRate: z.coerce.number().optional(),
  mailFrom: z.string().email("送信元は正しいメールアドレスで指定してください").optional(),
  invoicePrefix: z.string().max(20).optional(),
  // **`https` に限る。** 空文字は「無効にする」の意味なので許す
  alertSlackWebhook: z.union([z.literal(""), z.string().url().startsWith("https://")]).optional(),
  alertWebhookUrl: z.union([z.literal(""), z.string().url().startsWith("https://")]).optional(),
  signatureThreshold: z.coerce.number().optional(),
});
import { currentUser } from "../../../../server/authorize";
import "../../../../server/env";
import { settingsStore, auditActions } from "../../../../server/platform-services";

function admin(req: Request) {
  const user = currentUser(req);
  return user && user.roles.includes("admin") ? user : null;
}

async function handleGET(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  return Response.json({ settings: await settingsStore.get() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = admin(req);
  if (!user) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  const parsed = validate(SettingsPatch, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  // ストアは文字列で受けるので、検証済みの値を文字列へ揃えて渡す
  const patch = Object.fromEntries(
    Object.entries(parsed.value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
  );
  const settings = await settingsStore.update(patch);
  await auditActions.record(user.email, "settings.update", "system", { after: settings as unknown as Record<string, unknown> });
  return Response.json({ settings });
}

export const GET = withApiObservability("/api/admin/settings", handleGET);
export const POST = withApiObservability("/api/admin/settings", handlePOST);
