/** 通知テンプレート一覧とプレビュー(GET ?event=&locale=)。管理者の上書きを反映した解決結果で描画する。認証ユーザー。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { templateStore } from "../../../../server/platform-services.js";
import { templateEvents, resolveTemplates, renderWithTemplates, type Locale } from "../../../../server/notification-templates.js";

const SAMPLE: Record<string, Record<string, string | number>> = {
  "approval.requested": { docType: "見積書", docNumber: "Q-001", amount: 150000 },
  "invoice.created": { number: "INV-0001", billTo: "株式会社サンプル" },
  "approval.decided": { docType: "見積書", docNumber: "Q-001", result: "承認" },
};

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const url = new URL(req.url);
  const event = url.searchParams.get("event");
  const locale = (url.searchParams.get("locale") ?? "ja") as Locale;
  if (event) {
    const resolved = resolveTemplates(await templateStore.get());
    const rendered = renderWithTemplates(resolved, event, SAMPLE[event] ?? {}, locale);
    if (!rendered) return Response.json({ error: "未知のイベントです" }, { status: 404 });
    return Response.json({ event, locale, rendered });
  }
  return Response.json({ events: templateEvents() });
}

export const GET = withApiObservability("/api/notifications/templates", handleGET);
