/** アンケート: 公開状態の変更(POST)。manager 以上。 */
import { withApiObservability } from "../../../../../server/instrument.js";
import { audienceRecipients } from "../../../../../server/survey-repo.js";
import { currentUser, requirePermission } from "../../../../../server/authorize.js";
import { serverEnv } from "../../../../../server/env.js";
import { surveyStore, userStore, appMailer, auditActions, settingsStore } from "../../../../../server/platform-services.js";

async function handlePOST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "inquiry:write");
  const { id } = await ctx.params;
  const body = (await req.json()) as { status?: "draft" | "open" | "closed" };
  if (!body.status || !["draft", "open", "closed"].includes(body.status)) return Response.json({ error: "状態が不正です" }, { status: 400 });
  await surveyStore.setStatus(id, body.status);
  let notified = 0;
  if (body.status === "open") {
    const survey = await surveyStore.get(id);
    if (survey) {
      const recipients = audienceRecipients(await userStore.list(), survey.audience);
      if (recipients.length > 0) {
        await appMailer.sendMail({ to: recipients, from: (await settingsStore.get()).mailFrom, subject: `[アンケート] ${survey.title} のお願い`, text: `アンケート「${survey.title}」が公開されました。ご回答をお願いします。\n/surveys/${id}` });
        notified = recipients.length;
      }
    }
  }
  await auditActions.record(user!.email, "survey.setStatus", `survey:${id}`, { after: { status: body.status, notified } });
  return Response.json({ id, status: body.status, notified });
}

export const POST = withApiObservability("/api/surveys/[id]/status", handlePOST);
