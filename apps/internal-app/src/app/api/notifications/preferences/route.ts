/**
 * 通知プレファレンス API。
 * - GET: 現在の設定を返す。
 * - PUT: 設定を保存（全置換）。ボディは NotificationPreference（defaultChannels / categories / quietHours）。
 */
import type { NotificationPreference } from "@platform/notify";
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { preferenceStore } from "../../../../server/platform-services.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");
  return Response.json({ preference: await preferenceStore.get(user!.email) });
}

async function handlePUT(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");
  const body = (await req.json()) as NotificationPreference;
  await preferenceStore.set(user!.email, body);
  return Response.json({ preference: await preferenceStore.get(user!.email) });
}

export const GET = withApiObservability("/api/notifications/preferences", handleGET);
export const PUT = withApiObservability("/api/notifications/preferences", handlePUT);
