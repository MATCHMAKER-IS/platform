// public-api: 定期実行の入口。人ではなく仕組みが叩くため、セッション認可ではなく共有鍵で守る
/**
 * 残高を取って記録する（定期実行の入口）。
 *
 * cron から **1 日に数回**叩きます。
 *
 * **誰でも叩けると困る**ので、共有の鍵で守ります。
 * 認可（セッション）は使いません。人ではなく仕組みが叩くためです。
 */
import { collectAndPrune } from "../../../server/collect";
import { env } from "../../../server/env";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  // 鍵が未設定なら受け付けない。**開けっ放しにしない**
  const secret = env.COLLECT_SECRET;
  if (!secret) {
    return Response.json(
      { error: "COLLECT_SECRET が未設定のため、実行できません" },
      { status: 503 },
    );
  }

  const given = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (given !== secret) {
    // 理由は返さない（鍵を探る手がかりを与えない）
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  const result = await collectAndPrune();

  // 間引きを見送った場合は 207（一部だけ成功）で返し、監視で気づけるようにする
  const status = result.skippedReason ? 207 : 200;
  return Response.json(result, { status });
}
