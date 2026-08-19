/** アンケート: 未回答者へのリマインド(POST)。対象者のうち未回答の人の受信箱へ再送。manager 以上。 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import "../../../../../server/env";
import { surveyStore, userStore, appMailer, auditActions, settingsStore } from "../../../../../server/platform-services";
import { audienceRecipients, pendingRespondents } from "../../../../../server/survey-repo";

async function handlePOST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "inquiry:write");
  const { id } = await ctx.params;
  const survey = await surveyStore.get(id);
  if (!survey) return Response.json({ error: "アンケートが見つかりません" }, { status: 404 });
  if (survey.status !== "open") return Response.json({ error: "公開中のアンケートのみリマインドできます" }, { status: 409 });
  const recipients = audienceRecipients(await userStore.list(), survey.audience);
  const pending = pendingRespondents(recipients, await surveyStore.responses(id));
  if (pending.length > 0) {
    // **1 件ずつ送る。** cron 版(remind-scan)は既に 1 件ずつに直して
    // あったが、この手動トリガー版は直っていなかった——同じ機能の
    // 2 つの経路が食い違っていた(2026-08 に発見)。
    const mailFrom = (await settingsStore.get()).mailFrom;
    for (const to of pending) {
      await appMailer.sendMail({ to, from: mailFrom, subject: `[リマインド] ${survey.title} は未回答です`, text: `アンケート「${survey.title}」がまだ回答されていません。${survey.closesAt ? `締切: ${survey.closesAt.slice(0, 10)}。` : ""}\n/surveys/${id}` });
    }
  }
  await auditActions.record(user!.email, "survey.remind", `survey:${id}`, { after: { reminded: pending.length, anonymous: survey.anonymous } });
  return Response.json({ reminded: pending.length, anonymous: survey.anonymous });
}

export const POST = withApiObservability("/api/surveys/[id]/remind", handlePOST);
