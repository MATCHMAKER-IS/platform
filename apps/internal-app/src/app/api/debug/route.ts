/**
 * Platform Debugger の API。開発時のみ有効。
 *
 * **本番では 404 を返す**(featureEnv.DEBUG_TOOL は NODE_ENV=production で強制的に false)。
 * 認証も不要にしている(開発環境限定のため)。本番で開くことは構造上できない。
 */
import { featureEnv } from "../../../server/env";
import { debugCollector } from "../../../server/debug-collector";
import { findIssues } from "@platform/debug";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  // 無効時は存在しないことにする(本番で情報を漏らさない)
  if (!featureEnv.DEBUG_TOOL) return new Response("Not Found", { status: 404 });

  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const found = debugCollector.get(id);
    if (!found) return Response.json({ error: "記録が見つかりません(古くて捨てられた可能性)" }, { status: 404 });
    const summary = debugCollector.summarize(found);
    return Response.json({ request: found, summary, issues: findIssues(found, summary) });
  }

  const list = debugCollector.list(50).map((r) => {
    const summary = debugCollector.summarize(r);
    return {
      requestId: r.requestId,
      method: r.method,
      path: r.path,
      status: r.status,
      durationMs: r.durationMs,
      startedAt: r.startedAt,
      counts: summary.counts,
      issueCount: findIssues(r, summary).length,
    };
  });
  return Response.json({ enabled: true, requests: list });
}

export async function DELETE(): Promise<Response> {
  if (!featureEnv.DEBUG_TOOL) return new Response("Not Found", { status: 404 });
  debugCollector.clear();
  return Response.json({ ok: true });
}
