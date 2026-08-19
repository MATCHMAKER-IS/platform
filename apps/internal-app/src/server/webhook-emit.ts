/**
 * イベントの配信。
 *
 * 購読に一致する送信先へ、署名付きで届ける。
 *
 * **本処理は止めない(best-effort)。**
 * 相手が落ちていても、請求書の作成そのものは成功させる。
 * ただし**失敗を握りつぶさない** — 記録に残し、後から追えるようにする。
 * @packageDocumentation
 */
import { webhookSubscriptionStore } from "./platform-services";
import { isSafeExternalUrl } from "@platform/net";
import { buildDeliveries } from "./outbound-webhook";

/**
 * 1 件あたりの制限時間(ミリ秒)。
 *
 * **相手が応答しないと、こちらが待たされる。**
 * 購読が 10 件あれば、最悪 10 件分待つことになる
 * (`Promise.all` で並行に投げるので実際は 1 件分だが、
 * 制限が無いと永久に終わらない)。
 */
const TIMEOUT_MS = 5000;

/**
 * イベントを全購読へ配信する。
 *
 * @param event イベント名(`invoice.created` など)
 * @param data 本文に載せる値
 * @returns 送信を試みた件数
 */
export async function emitEvent(event: string, data: unknown): Promise<number> {
  try {
    const subs = await webhookSubscriptionStore.list();
    const deliveries = buildDeliveries(subs, event, data, new Date().toISOString());

    let sent = 0;
    await Promise.all(deliveries.map(async (d) => {
      // **送る前に宛先を確かめる。**
      // 管理画面から登録された URL をそのまま叩かない
      // **送る前に宛先を確かめる。**
      // 管理画面から登録された URL をそのまま叩かない(SSRF)
      const safe = isSafeExternalUrl(d.url);
      if (!safe.ok) {
        console.warn(`[webhook] 送信先として許可されていません(${safe.reason}): ${d.url}`);
        return;
      }
      try {
        const res = await fetch(d.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-webhook-signature": d.signature,
            // **時刻付きの署名。** 受け取る側がリプレイを防げる
            "x-webhook-signature-v2": d.signedAt,
            "x-webhook-event": d.event,
          },
          body: d.body,
          // **時間を切る。** 相手が応答しないとこちらが待たされる
          signal: AbortSignal.timeout(TIMEOUT_MS),
          // **リダイレクトを追わない。**
          // 追うと、許可した URL から社内アドレスへ飛ばされる
          redirect: "manual",
        });
        if (res.ok) { sent += 1; return; }
        // **失敗を握りつぶさない。** 相手が受け取れていないことに気づけない
        console.warn(`[webhook] ${d.event} → ${d.url}: ${res.status}`);
      } catch (e) {
        console.warn(`[webhook] ${d.event} → ${d.url}: 送信できませんでした`, e);
      }
    }));

    return sent;
  } catch {
    // 購読の取得に失敗しても、本処理は続ける
    return 0;
  }
}
