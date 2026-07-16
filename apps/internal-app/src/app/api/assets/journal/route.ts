/** 固定資産: 当年の減価償却仕訳(GET)。?year=。asset:read。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { assetStore } from "../../../../server/platform-services";
import { depreciationJournal, depreciationTotal } from "../../../../server/depreciation-journal";
import { journalToRows } from "@platform/accounting";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "asset:read");
  const year = Number(new URL(req.url).searchParams.get("year") ?? new Date().getFullYear());
  const assets = await assetStore.list();
  const entries = depreciationJournal(assets, year);
  return Response.json({ year, entries, rows: journalToRows(entries), total: depreciationTotal(assets, year) });
}

export const GET = withApiObservability("/api/assets/journal", handleGET);
