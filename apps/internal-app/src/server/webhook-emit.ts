/** イベント発火のヘルパ。購読に一致する送信 Webhook へ署名付きで配信する（best-effort）。 */
import { webhookSubscriptionStore } from "./platform-services";
import { buildDeliveries } from "./outbound-webhook";

/** イベントを全購読へ配信する。失敗しても本処理は継続（best-effort）。 */
export async function emitEvent(event: string, data: unknown): Promise<number> {
  try {
    const subs = await webhookSubscriptionStore.list();
    const deliveries = buildDeliveries(subs, event, data, new Date().toISOString());
    await Promise.all(deliveries.map((d) =>
      fetch(d.url, { method: "POST", headers: { "content-type": "application/json", "x-webhook-signature": d.signature, "x-webhook-event": d.event }, body: d.body }).catch(() => undefined),
    ));
    return deliveries.length;
  } catch {
    return 0;
  }
}
