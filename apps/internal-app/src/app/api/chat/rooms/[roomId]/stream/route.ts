/**
 * チャット受信 API（GET・Server-Sent Events）。ルームを購読し、届いたメッセージを
 * `data: {json}\n\n` 形式で送り続ける。切断時は購読解除。長時間接続のため観測ラッパは付けない。
 */
import { currentUser, requirePermission } from "../../../../../../server/authorize";
import { serverEnv } from "../../../../../../server/env";
import { chatGateway, presence } from "../../../../../../server/chat";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");

  const connectionId = crypto.randomUUID();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      // 接続確立の合図
      controller.enqueue(encoder.encode(`event: open\ndata: ${JSON.stringify({ roomId })}\n\n`));
      await chatGateway.connect(roomId, connectionId, send);
      presence.heartbeat(roomId, user!.email, Date.now());
      req.signal.addEventListener("abort", () => {
        void chatGateway.disconnect(roomId, connectionId);
        presence.offline(roomId, user!.email);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
