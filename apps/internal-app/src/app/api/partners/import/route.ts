/** 取引先: CSV取り込み(POST)。CSVを解析して取引先マスタへ一括upsert。partner:write。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { partnerStore, auditActions } from "../../../../server/platform-services";
import { parsePartnerCsv } from "../../../../server/csv-import";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "partner:write");
  const body = (await req.json()) as { csv?: string };
  if (!body.csv || body.csv.trim().length === 0) return Response.json({ error: "CSV 本文が空です" }, { status: 400 });
  const { rows, errors } = parsePartnerCsv(body.csv);
  for (const partner of rows) await partnerStore.upsert(partner);
  await auditActions.record(user!.email, "partner.import", `count:${rows.length}`, { after: { imported: rows.length, errors: errors.length } });
  return Response.json({ imported: rows.length, errors });
}

export const POST = withApiObservability("/api/partners/import", handlePOST);
