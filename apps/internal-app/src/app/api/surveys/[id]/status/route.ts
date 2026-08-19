/** アンケート: 公開状態の変更(POST)。manager 以上。 */
import { withApiObservability } from "../../../../../server/instrument";
import { audienceRecipients } from "../../../../../server/survey-repo";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import "../../../../../server/env";
import { surveyStore, userStore, appMailer, auditActions, settingsStore } from "../../../../../server/platform-services";

async function handlePOST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "inquiry:write");
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { status?: "draft" | "open" | "closed" };
  if (!body.status || !["draft", "open", "closed"].includes(body.status)) return Response.json({ error: "状態が不正です" }, { status: 400 });
  await surveyStore.setStatus(id, body.status);
  let notified = 0;
  if (body.status === "open") {
    const survey = await surveyStore.get(id);
    if (survey) {
      const recipients = audienceRecipients(await userStore.list(), survey.audience);
      if (recipients.length > 0) {
        // **1 件ずつ送る。** remind-scan・[id]/remind と同じ理由
        // (2026-08、この経路も食い違っていたのを発見)。
        const mailFrom = (await settingsStore.get()).mailFrom;
        for (const to of recipients) {
          await appMailer.sendMail({ to, from: mailFrom, subject: `[アンケート] ${survey.title} のお願い`, text: `アンケート「${survey.title}」が公開されました。ご回答をお願いします。\n/surveys/${id}` });
        }
        notified = recipients.length;
      }
    }
  }
  await auditActions.record(user!.email, "survey.setStatus", `survey:${id}`, { after: { status: body.status, notified } });
  return Response.json({ id, status: body.status, notified });
}

export const POST = withApiObservability("/api/surveys/[id]/status", handlePOST);
