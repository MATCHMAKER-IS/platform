/**
 * アンケート: 締切間近の未回答者へ自動リマインド(POST)。cron 等から定期実行。
 * X-Cron-Token(env CRON_TOKEN)一致、または管理者で実行可。既定は締切3日以内の公開中を対象。
 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import { serverEnv, featureEnv } from "../../../../server/env";
import { surveyStore, userStore, appMailer, alertSeenStore, auditActions, settingsStore } from "../../../../server/platform-services";
import { surveysDueForReminder, audienceRecipients, pendingRespondents } from "../../../../server/survey-repo";

const DAYS_BEFORE = 3;
const TTL_MS = 20 * 60 * 60 * 1000; // 同一アンケートは20時間再送しない

async function authorized(req: Request): Promise<boolean> {
  const token = featureEnv.CRON_TOKEN;
  if (token && req.headers.get("x-cron-token") === token) return true;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return !!user && user.roles.includes("admin");
}

async function handlePOST(req: Request): Promise<Response> {
  if (!(await authorized(req))) return Response.json({ error: "権限がありません" }, { status: 403 });
  const due = surveysDueForReminder(await surveyStore.list(), new Date(), DAYS_BEFORE);
  const users = await userStore.list();
  let remindedSurveys = 0;
  let remindedPeople = 0;
  for (const survey of due) {
    if (alertSeenStore.markSeen(`survey-remind:${survey.id}`, TTL_MS)) continue; // 重複抑制
    const recipients = audienceRecipients(users, survey.audience);
    const pending = pendingRespondents(recipients, await surveyStore.responses(survey.id));
    if (pending.length > 0) {
      await appMailer.sendMail({ to: pending, from: (await settingsStore.get()).mailFrom, subject: `[リマインド] ${survey.title} は締切間近です`, text: `アンケート「${survey.title}」の締切が近づいています（${survey.closesAt?.slice(0, 10)}）。ご回答をお願いします。\n/surveys/${survey.id}` });
      remindedSurveys += 1;
      remindedPeople += pending.length;
    }
  }
  if (remindedSurveys > 0) await auditActions.record("system", "survey.remind.scan", `surveys:${remindedSurveys}`, { after: { surveys: remindedSurveys, people: remindedPeople } });
  return Response.json({ due: due.length, remindedSurveys, remindedPeople });
}

export const POST = withApiObservability("/api/surveys/remind-scan", handlePOST);
