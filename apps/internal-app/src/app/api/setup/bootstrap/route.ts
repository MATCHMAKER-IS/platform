/**
 * 初回セットアップ(POST)。最初の管理者作成＋初期設定投入。
 * 既に管理者が存在する場合は 409（乗っ取り防止）。認証不要（管理者不在時のみ有効）。
 */
import { withApiObservability } from "../../../../server/instrument.js";
import { userStore, settingsStore, auditActions } from "../../../../server/platform-services.js";
import { hashPassword } from "../../../../server/password.js";
import { canBootstrapAdmin, defaultSeedPlan } from "../../../../server/setup.js";

async function handlePOST(req: Request): Promise<Response> {
  const users = await userStore.list();
  const adminCount = users.filter((u) => u.roles.includes("admin")).length;
  if (!canBootstrapAdmin(adminCount)) return Response.json({ error: "既に管理者が存在します。セットアップは完了しています。" }, { status: 409 });
  const body = (await req.json()) as { email?: string; name?: string; password?: string; companyName?: string };
  if (!body.email || !body.name || !body.password || !body.companyName) return Response.json({ error: "email・name・password・companyName が必要です" }, { status: 400 });
  if (body.password.length < 8) return Response.json({ error: "パスワードは8文字以上にしてください" }, { status: 400 });
  await userStore.upsert({ email: body.email, name: body.name, department: "経営", roles: ["admin"], active: true });
  await userStore.setPassword(body.email, hashPassword(body.password));
  const plan = defaultSeedPlan(body.companyName);
  await settingsStore.update({ companyName: plan.settings.companyName, fiscalClosingMonth: String(plan.settings.fiscalClosingMonth), consumptionTaxRate: String(plan.settings.consumptionTaxRate) });
  await auditActions.record(body.email, "setup.bootstrap", "first-admin", { after: { company: body.companyName } });
  return Response.json({ ok: true, admin: body.email }, { status: 201 });
}

export const POST = withApiObservability("/api/setup/bootstrap", handlePOST);
