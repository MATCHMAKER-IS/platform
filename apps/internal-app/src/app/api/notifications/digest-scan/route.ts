/**
 * ダイジェスト配信スキャン(POST)。頻度が来た利用者へ未読通知のまとめをメール送信。cron 等から定期実行。
 * X-Cron-Token(env CRON_TOKEN)一致、または管理者。
 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv, featureEnv } from "../../../../server/env.js";
import { digestSettingStore, notificationStore, appMailer, settingsStore } from "../../../../server/platform-services.js";
import { isDigestDue, buildDigestSummary, type DigestItem } from "../../../../server/digest.js";

async function authorized(req: Request): Promise<boolean> {
  const token = featureEnv.CRON_TOKEN;
  if (token && req.headers.get("x-cron-token") === token) return true;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return !!user && user.roles.includes("admin");
}

async function handlePOST(req: Request): Promise<Response> {
  if (!(await authorized(req))) return Response.json({ error: "権限がありません" }, { status: 403 });
  const now = new Date();
  const mailFrom = (await settingsStore.get()).mailFrom;
  const all = await digestSettingStore.all();
  let sent = 0;
  for (const { email, setting } of all) {
    if (!isDigestDue(setting, now)) continue;
    const unread = await notificationStore.list(email, { unreadOnly: true, limit: 50 });
    const items: DigestItem[] = unread.map((n) => ({ title: n.title, at: n.createdAt }));
    const summary = buildDigestSummary(items);
    if (summary) {
      await appMailer.sendMail({ to: [email], from: mailFrom, subject: summary.subject, text: summary.body });
      sent += 1;
    }
    await digestSettingStore.set(email, { frequency: setting.frequency, lastSentAt: now.toISOString() });
  }
  return Response.json({ scanned: all.length, sent });
}

export const POST = withApiObservability("/api/notifications/digest-scan", handlePOST);
