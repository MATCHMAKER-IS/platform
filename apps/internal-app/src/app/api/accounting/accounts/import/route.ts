/** 勘定科目: CSV取り込み(POST)。科目・区分を一括upsert。dryRun でプレビュー。accounting:read。 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { accountMasterStore, auditActions } from "../../../../../server/platform-services";
import { parseAccountCsv } from "../../../../../server/csv-import";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "accounting:read");
  const body = (await req.json()) as { csv?: string; dryRun?: boolean };
  if (!body.csv || body.csv.trim().length === 0) return Response.json({ error: "CSV 本文が空です" }, { status: 400 });
  const { rows, errors } = parseAccountCsv(body.csv);
  if (body.dryRun) return Response.json({ preview: true, valid: rows.length, errors });
  for (const def of rows) await accountMasterStore.upsert(def);
  await auditActions.record(user!.email, "account.import", `count:${rows.length}`, { after: { imported: rows.length, errors: errors.length } });
  return Response.json({ imported: rows.length, errors });
}

export const POST = withApiObservability("/api/accounting/accounts/import", handlePOST);
