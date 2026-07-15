/** 会計: 手動仕訳(決算整理)のCSV取込(POST)。貸借一致した仕訳のみ登録。accounting:read（財務）。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { manualJournalStore, auditActions } from "../../../../server/platform-services.js";
import { parseJournalCsv } from "../../../../server/csv-import.js";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "accounting:read");
  const body = (await req.json()) as { csv?: string };
  if (!body.csv || body.csv.trim().length === 0) return Response.json({ error: "CSV 本文が空です" }, { status: 400 });
  const { rows, errors } = parseJournalCsv(body.csv);
  const imported = await manualJournalStore.add(rows);
  await auditActions.record(user!.email, "journal.import", `count:${imported}`, { after: { imported, errors: errors.length } });
  return Response.json({ imported, errors });
}

export const POST = withApiObservability("/api/accounting/journal-import", handlePOST);
