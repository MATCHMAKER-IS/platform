/**
 * 通知プレファレンス API。
 * - GET: 現在の設定を返す。
 * - PUT: 設定を保存（全置換）。ボディは NotificationPreference（defaultChannels / categories / quietHours）。
 */
import type { NotificationPreference } from "@platform/notify";
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { preferenceStore } from "../../../../server/platform-services";
import { validate, z } from "@platform/validation";

const DeliveryChannel = z.enum(["email", "slack", "line", "sms", "push", "inApp"]);

/**
 * 通知プレファレンスの入力。
 *
 * **これまで完全無検証だった。** `as NotificationPreference` のキャストのみで、
 * `channels` に配列でない値、`quietHours.start` に時刻でない値を入れても
 * そのまま保存されていた——**通知配信ロジック全体がこの設定を読むので、
 * 壊れた値が入るとチャネル解決や静音時間の判定が壊れる**。
 */
const PreferenceInput = z.object({
  userId: z.string().optional(),
  categories: z.record(
    z.string(),
    z.object({ channels: z.array(DeliveryChannel), mode: z.enum(["immediate", "digest", "off"]).optional() }),
  ).optional(),
  defaultChannels: z.array(DeliveryChannel).optional(),
  quietHours: z.object({
    start: z.number().int().min(0).max(23),
    end: z.number().int().min(0).max(23),
  }).optional(),
});

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "chat:read");
  return Response.json({ preference: await preferenceStore.get(user!.email) });
}

async function handlePUT(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "chat:read");
  const parsed = validate(PreferenceInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  await preferenceStore.set(user!.email, parsed.value as NotificationPreference);
  return Response.json({ preference: await preferenceStore.get(user!.email) });
}

export const GET = withApiObservability("/api/notifications/preferences", handleGET);
export const PUT = withApiObservability("/api/notifications/preferences", handlePUT);
