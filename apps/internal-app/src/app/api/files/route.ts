/**
 * ファイル一覧/削除 API。
 * - GET: 一覧（`?prefix=&limit=`）。
 * - DELETE: 実体と登録を削除（ボディ `{ key }`）。
 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser, requirePermission } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { fileManager, auditActions } from "../../../server/platform-services";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");
  const url = new URL(req.url);
  const options: { prefix?: string; limit?: number } = {};
  const prefix = url.searchParams.get("prefix");
  const limit = url.searchParams.get("limit");
  if (prefix) options.prefix = prefix;
  if (limit) options.limit = Number(limit) || 100;
  return Response.json({ files: await fileManager.list(options) });
}

async function handleDELETE(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:post");
  const body = (await req.json()) as { key?: string };
  if (!body.key) return Response.json({ error: "key が必要です" }, { status: 400 });
  const res = await fileManager.remove(body.key);
  if (!res.ok) return Response.json({ error: res.error }, { status: 400 });
  await auditActions.fileDelete(user!.email, body.key);
  return new Response(null, { status: 204 });
}

export const GET = withApiObservability("/api/files", handleGET);
export const DELETE = withApiObservability("/api/files", handleDELETE);
