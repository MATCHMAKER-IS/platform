// public-api: 起動完了の確認。ロードバランサが認可なしで叩く
/**
 * 受け入れ可能か。
 *
 * 起動していれば受け入れてよい（freee が無くても見本データで応答できる）。
 */
import { runHealthChecks } from "@platform/observability";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const report = await runHealthChecks({ process: () => true }, { timeoutMs: 2000 });
  return Response.json(report, { status: report.status === "healthy" ? 200 : 503 });
}
