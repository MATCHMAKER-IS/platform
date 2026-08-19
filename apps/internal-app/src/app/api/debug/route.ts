// public-api: デモ用の疑似データ。本番では公開しない
// no-rate-limit: `featureEnv.DEBUG_TOOL` が真のときだけ応答し、**本番では 404**。
// 開発端末でしか到達しないため、回数で守る意味がない
// (制限を入れると、開発中に自分で詰まる)
/**
 * Platform Debugger の API。開発時のみ有効。
 *
 * **本番では 404 を返す**(featureEnv.DEBUG_TOOL は NODE_ENV=production で強制的に false)。
 * 認証も不要にしている(開発環境限定のため)。本番で開くことは構造上できない。
 */
import { featureEnv } from "../../../server/env";
import { debugCollector } from "../../../server/debug-collector";
import { findIssues } from "@platform/debug";
import { withApiObservability } from "../../../server/instrument";

export const dynamic = "force-dynamic";

async function handleGET(req: Request): Promise<Response> {
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

// no-audit: 開発専用ツールが集めた一時データの消去(本番では 404 を返す)。
// **業務データではない**ので、消えても失われるものが無い。
// ここを記録すると、本当に見たい削除が埋もれる。
async function handleDELETE(): Promise<Response> {
  if (!featureEnv.DEBUG_TOOL) return new Response("Not Found", { status: 404 });
  debugCollector.clear();
  return Response.json({ ok: true });
}

export const GET = withApiObservability("/api/debug", handleGET);
export const DELETE = withApiObservability("/api/debug", handleDELETE);
