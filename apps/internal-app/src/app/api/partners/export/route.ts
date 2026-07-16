/** 取引先: CSV書き出し(GET)。全取引先をCSVでダウンロード。partner:read。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { partnerStore } from "../../../../server/platform-services";
import { partnersCsv } from "../../../../server/partner-export";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "partner:read");
  const csv = partnersCsv(await partnerStore.list());
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="partners.csv"' } });
}

export const GET = withApiObservability("/api/partners/export", handleGET);
