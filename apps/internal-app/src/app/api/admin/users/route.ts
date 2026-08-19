/** 管理: ユーザー・権限ディレクトリ 一覧(GET)・登録更新/有効無効(POST)。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import "../../../../server/env";
import { userStore, appMailer, auditActions } from "../../../../server/platform-services";
import { ASSIGNABLE_ROLES } from "../../../../server/user-repo";
import { KNOWN_PERMISSIONS, effectivePermissions } from "../../../../server/permission-matrix";
import { APP_POLICY } from "../../../../server/policy";
import { generatePassword, hashPassword } from "../../../../server/password";

function requireAdmin(req: Request) {
  const user = currentUser(req);
  if (!user || !user.roles.includes("admin")) return null;
  return user;
}

async function handleGET(req: Request): Promise<Response> {
  const user = requireAdmin(req);
  if (!user) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  return Response.json({ users: await userStore.list(), roles: ASSIGNABLE_ROLES, permissions: KNOWN_PERMISSIONS });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = requireAdmin(req);
  if (!user) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { email: string; name?: string; department?: string; roles?: string[]; permissions?: string[]; active?: boolean; setActive?: boolean; reissuePassword?: boolean };
  if (!body.email) return Response.json({ error: "email が必要です" }, { status: 400 });
  // パスワード再発行: 一時パスワードを生成しハッシュ保存、受信箱へ通知、平文は一度だけ返す
  if (body.reissuePassword) {
    const target = await userStore.get(body.email);
    if (!target) return Response.json({ error: "利用者が見つかりません" }, { status: 404 });
    const temp = generatePassword();
    await userStore.setPassword(body.email, hashPassword(temp));
    await appMailer.sendMail({ to: body.email, from: user.email, subject: "パスワードが再発行されました", text: `一時パスワード: ${temp}
初回ログイン後に変更してください。` });
    await auditActions.record(user.email, "user.reissuePassword", `user:${body.email}`, {});
    return Response.json({ email: body.email, temporaryPassword: temp });
  }
  // **無効化したらセッションも切る。**
  // 権限を消してもセッションが生きていれば操作できる(ADR-0017 の「順序が大事」)
  if (body.setActive === false || body.roles !== undefined || body.permissions !== undefined) {
    await userStore.revokeSessions(body.email);
  }
  if (typeof body.setActive === "boolean") {
    await userStore.setActive(body.email, body.setActive);
    await auditActions.record(user.email, "user.setActive", `user:${body.email}`, { after: { active: body.setActive } });
    return Response.json({ email: body.email, active: body.setActive });
  }
  const saved = await userStore.upsert({ email: body.email, name: body.name ?? body.email, department: body.department, roles: body.roles ?? [], permissions: body.permissions, active: body.active });
  // **権限の差分を記録に含める。**
  // `after` だけだと「**いま何を持っているか**」しか残らず、
  // **何が足されたのか**が分かりません——
  // **「誰がいつ管理者権限を付けたか」**は、後から必ず聞かれます。
  await auditActions.record(user.email, "user.upsert", `user:${body.email}`, { after: { department: saved.department, roles: saved.roles, permissions: saved.permissions, active: saved.active, roleChanges: saved.roleChanges } });
  return Response.json({ ...saved, effective: effectivePermissions(APP_POLICY, saved.roles, saved.permissions) }, { status: 201 });
}

export const GET = withApiObservability("/api/admin/users", handleGET);
export const POST = withApiObservability("/api/admin/users", handlePOST);
