/** 設定(読み取り): アプリ全体で使う非機密設定を返す(GET)。認証ユーザー向け。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser } from "../../../server/authorize";
import "../../../server/env";
import { settingsStore } from "../../../server/platform-services";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const s = await settingsStore.get();
  return Response.json({ companyName: s.companyName, consumptionTaxRate: s.consumptionTaxRate, invoicePrefix: s.invoicePrefix, fiscalClosingMonth: s.fiscalClosingMonth });
}

export const GET = withApiObservability("/api/settings", handleGET);
