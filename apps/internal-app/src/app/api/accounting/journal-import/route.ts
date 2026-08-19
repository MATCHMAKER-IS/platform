/** 会計: 手動仕訳(決算整理)のCSV取込(POST)。貸借一致した仕訳のみ登録。accounting:read（財務）。 */
import { withApiObservability } from "../../../../server/instrument";
// **二重送信を防ぐ。** 仕訳の取り込みは連打・再送で二重に走ると、
// 同じ仕訳が二重に計上され、**試算表が合わなくなる**。
import { withIdempotency } from "@platform/http";
import { idempotencyStore } from "../../../../server/idempotency";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { manualJournalStore, auditActions } from "../../../../server/platform-services";
import { parseJournalCsv } from "../../../../server/csv-import";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "accounting:write");
  // **キーが無ければ素通し。** 付けるのは呼び出し側の責任。
  return withIdempotency(req, { store: idempotencyStore, scope: user!.email }, () => run(req, user!.email));
}

/** 本体(冪等キーの内側で 1 回だけ動く)。 */
async function run(req: Request, actor: string): Promise<Response> {
  // **書き込みは read では通さない。**
  // 参照できる人が会計データを書き換えられてしまう(2026-08 に発見)
  const body = (await req.json().catch(() => ({}))) as { csv?: string };
  if (!body.csv || body.csv.trim().length === 0) return Response.json({ error: "CSV 本文が空です" }, { status: 400 });
  const { rows, errors } = parseJournalCsv(body.csv);
  const imported = await manualJournalStore.add(rows);
  await auditActions.record(actor, "journal.import", `count:${imported}`, { after: { imported, errors: errors.length } });
  return Response.json({ imported, errors });
}

export const POST = withApiObservability("/api/accounting/journal-import", handlePOST);
