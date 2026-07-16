/** 会計: 手動仕訳の一覧(GET)。?year=。accounting:read。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { manualJournalStore } from "../../../../server/platform-services";
import { journalToRows } from "@platform/accounting";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "accounting:read");
  const yearParam = new URL(req.url).searchParams.get("year");
  const year = yearParam ? Number(yearParam) : undefined;
  const items = await manualJournalStore.list(year);
  return Response.json({ items, rows: journalToRows(items.map((m) => m.entry)) });
}

export const GET = withApiObservability("/api/accounting/journal-entries", handleGET);
