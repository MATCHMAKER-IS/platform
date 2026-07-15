/** 設定(読み取り): アプリ全体で使う非機密設定を返す(GET)。認証ユーザー向け。 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { settingsStore } from "../../../server/platform-services.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const s = await settingsStore.get();
  return Response.json({ companyName: s.companyName, consumptionTaxRate: s.consumptionTaxRate, invoicePrefix: s.invoicePrefix, fiscalClosingMonth: s.fiscalClosingMonth });
}

export const GET = withApiObservability("/api/settings", handleGET);
