// public-api: Webhook イベントの一覧(仕様書の一部)。開発者が実装前に読む
/** 送信Webhookのイベントカタログ(GET)。開発者向け。認証不要。 */
import { withApiObservability } from "../../../../server/instrument";
import { WEBHOOK_EVENTS, WEBHOOK_SIGNATURE_DOC } from "../../../../server/api-reference";
import { limitPublic } from "../../../../server/rate-limit";

async function handleGET(req: Request): Promise<Response> {
  // **仕様書として社外の開発者が読む。** 認可が無いので回数で守る
  const limited = await limitPublic(req, "v1-events");
  if (limited) return limited;
  return Response.json({ events: WEBHOOK_EVENTS, signature: WEBHOOK_SIGNATURE_DOC });
}

export const GET = withApiObservability("/api/v1/events", handleGET);
