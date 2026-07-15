/**
 * アクセス解析 API。
 * - POST: イベント記録（`{ type, path, sessionId, userId?, referrer?, name? }`）。認証不要（計測ビーコン）。
 * - GET: 概況＋時系列（`?from=&to=&bucket=day|hour`）。管理者のみ。
 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { analytics } from "../../../server/platform-services.js";

interface TrackBody {
  type?: "pageview" | "click" | "custom";
  path?: string;
  sessionId?: string;
  userId?: string;
  referrer?: string;
  name?: string;
}

async function handlePOST(req: Request): Promise<Response> {
  const body = (await req.json()) as TrackBody;
  if (!body.path || !body.sessionId) return Response.json({ error: "path と sessionId が必要です" }, { status: 400 });
  const input: { type: "pageview" | "click" | "custom"; path: string; sessionId: string; userId?: string; referrer?: string; name?: string } = {
    type: body.type ?? "pageview",
    path: body.path,
    sessionId: body.sessionId,
  };
  if (body.userId) input.userId = body.userId;
  if (body.referrer) input.referrer = body.referrer;
  if (body.name) input.name = body.name;
  await analytics.track(input);
  return new Response(null, { status: 204 });
}

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "audit:read");
  const url = new URL(req.url);
  const range: { from?: string; to?: string } = {};
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from) range.from = from;
  if (to) range.to = to;
  const bucket = url.searchParams.get("bucket") === "hour" ? "hour" : "day";
  const [summary, series] = await Promise.all([analytics.summary(range, 8), analytics.series(range, bucket)]);
  return Response.json({ summary, series });
}

export const POST = withApiObservability("/api/analytics", handlePOST);
export const GET = withApiObservability("/api/analytics", handleGET);
