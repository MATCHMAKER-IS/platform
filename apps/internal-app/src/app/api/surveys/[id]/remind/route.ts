/** アンケート: 未回答者へのリマインド(POST)。対象者のうち未回答の人の受信箱へ再送。manager 以上。 */
import { withApiObservability } from "../../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../../server/authorize.js";
import { serverEnv } from "../../../../../server/env.js";
import { surveyStore, userStore, appMailer, auditActions, settingsStore } from "../../../../../server/platform-services.js";
import { audienceRecipients, pendingRespondents } from "../../../../../server/survey-repo.js";

async function handlePOST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "inquiry:write");
  const { id } = await ctx.params;
  const survey = await surveyStore.get(id);
  if (!survey) return Response.json({ error: "アンケートが見つかりません" }, { status: 404 });
  if (survey.status !== "open") return Response.json({ error: "公開中のアンケートのみリマインドできます" }, { status: 409 });
  const recipients = audienceRecipients(await userStore.list(), survey.audience);
  const pending = pendingRespondents(recipients, await surveyStore.responses(id));
  if (pending.length > 0) {
    await appMailer.sendMail({ to: pending, from: (await settingsStore.get()).mailFrom, subject: `[リマインド] ${survey.title} は未回答です`, text: `アンケート「${survey.title}」がまだ回答されていません。${survey.closesAt ? `締切: ${survey.closesAt.slice(0, 10)}。` : ""}\n/surveys/${id}` });
  }
  await auditActions.record(user!.email, "survey.remind", `survey:${id}`, { after: { reminded: pending.length, anonymous: survey.anonymous } });
  return Response.json({ reminded: pending.length, anonymous: survey.anonymous });
}

export const POST = withApiObservability("/api/surveys/[id]/remind", handlePOST);
