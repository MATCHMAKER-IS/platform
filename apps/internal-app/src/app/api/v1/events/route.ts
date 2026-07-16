/** 送信Webhookのイベントカタログ(GET)。開発者向け。認証不要。 */
import { withApiObservability } from "../../../../server/instrument";
import { WEBHOOK_EVENTS, WEBHOOK_SIGNATURE_DOC } from "../../../../server/api-reference";

async function handleGET(_req: Request): Promise<Response> {
  return Response.json({ events: WEBHOOK_EVENTS, signature: WEBHOOK_SIGNATURE_DOC });
}

export const GET = withApiObservability("/api/v1/events", handleGET);
