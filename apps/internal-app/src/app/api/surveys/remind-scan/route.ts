/**
 * アンケート: 締切間近の未回答者へ自動リマインド(POST)。cron 等から定期実行。
 * X-Cron-Token(env CRON_TOKEN)一致、または管理者で実行可。既定は締切3日以内の公開中を対象。
 * 推奨頻度・他の scan API との一覧は `docs/ops/CRON_JOBS.md` を参照。
 */
import { withApiObservability } from "../../../../server/instrument";
import { isCronAuthorized } from "../../../../server/cron-auth";
import { surveyStore, userStore, appMailer, alertSeenStore, auditActions, settingsStore, preferenceStore } from "../../../../server/platform-services";
import { surveysDueForReminder, audienceRecipients, pendingRespondents } from "../../../../server/survey-repo";
import { decideDelivery, hasChannel } from "../../../../server/notification-prefs";
import { sendPushToUser } from "../../../../server/push-service";

const DAYS_BEFORE = 3;
const TTL_MS = 20 * 60 * 60 * 1000; // 同一アンケートは20時間再送しない

async function handlePOST(req: Request): Promise<Response> {
  if (!(isCronAuthorized(req))) return Response.json({ error: "権限がありません" }, { status: 403 });
  const due = surveysDueForReminder(await surveyStore.list(), new Date(), DAYS_BEFORE);
  const users = await userStore.list();
  let remindedSurveys = 0;
  let remindedPeople = 0;
  const mailFrom = (await settingsStore.get()).mailFrom;
  for (const survey of due) {
    if (alertSeenStore.markSeen(`survey-remind:${survey.id}`, TTL_MS)) continue; // 重複抑制
    const recipients = audienceRecipients(users, survey.audience);
    const pending = pendingRespondents(recipients, await surveyStore.responses(survey.id));
    for (const to of pending) {
      // **利用者の通知設定を尊重する。** 以前はメール一斉送信のみで、
      // 設定を変えても一切反映されなかった(`decideDelivery` が
      // chat.ts の 1 箇所でしか呼ばれていなかった。2026-08 に発見)。
      const decision = await decideDelivery(preferenceStore, to, { category: "report" });
      if (hasChannel(decision, "email")) {
        // **1 件ずつ送る。** `to` に配列を渡すと受信者全員に他の宛先が見える
        // (以前は `to: pending` と配列をそのまま渡していた——社内の受信箱
        // 配信とはいえ、設計として誤っていた)。
        await appMailer.sendMail({ to, from: mailFrom, subject: `[リマインド] ${survey.title} は締切間近です`, text: `アンケート「${survey.title}」の締切が近づいています(${survey.closesAt?.slice(0, 10)})。ご回答をお願いします。\n/surveys/${survey.id}` });
      }
      if (hasChannel(decision, "push")) {
        await sendPushToUser(to, { title: "アンケートの締切が近づいています", body: survey.title, url: `/surveys/${survey.id}` });
      }
    }
    if (pending.length > 0) {
      remindedSurveys += 1;
      remindedPeople += pending.length;
    }
  }
  if (remindedSurveys > 0) await auditActions.record("system", "survey.remind.scan", `surveys:${remindedSurveys}`, { after: { surveys: remindedSurveys, people: remindedPeople } });
  return Response.json({ due: due.length, remindedSurveys, remindedPeople });
}

export const POST = withApiObservability("/api/surveys/remind-scan", handlePOST);
