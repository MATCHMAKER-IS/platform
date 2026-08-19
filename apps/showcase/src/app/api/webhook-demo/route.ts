// public-api: デモ用の Webhook 受信口。実際の外部サービスからは呼ばれない。
/**
 * Webhook 受信のデモ用 API。**`@platform/webhook` をそのまま動かす**。
 *
 * この基盤の `verifyHmacSignature` は `node:crypto` を使うため、ブラウザでは動かない。
 * 以前のデモは Web Crypto で署名計算を再現していたが、**基盤が壊れても気づけない**ため、
 * サーバ側で本物を動かす形にした。
 *
 * 受信側で必ず要る 3 つを、この 1 つの関数が担っている:
 *   1. 署名の検証   … 送り主が本物か
 *   2. 冪等な処理   … 同じイベントが 2 回届いても 1 回だけ処理する
 *   3. 型別の振り分け … イベントの種類ごとに処理を分ける
 */
import { createWebhookReceiver, createMemoryWebhookStore } from "@platform/webhook";
import { handleRoute } from "@platform/http";

/** デモ用の共有シークレット。**本番は環境変数から読む**(コードに置かない)。 */
const SECRET = "demo-webhook-secret";

/** イベントの形(実際は送り主のサービスが決める)。 */
interface DemoEvent {
  id: string;
  type: string;
  data?: Record<string, unknown>;
}

/**
 * 冪等ストアは**プロセスの寿命だけ**保つ。
 * 本番は DB や Redis に置く(サーバが再起動すると重複判定が消えるため)。
 */
const store = createMemoryWebhookStore();

/** 処理した内容を画面に返すため、直近の記録を残す。 */
const processed: { at: string; type: string; detail: string }[] = [];

const receiver = createWebhookReceiver<DemoEvent>({
  secret: SECRET,
  store,
  parse: (payload) => JSON.parse(payload) as DemoEvent,
  eventId: (e) => e.id,
  eventType: (e) => e.type,
})
  .on("payment.succeeded", (e) => {
    processed.push({ at: new Date().toISOString(), type: e.type, detail: `入金 ${String(e.data?.amount ?? "?")} 円を計上` });
  })
  .on("user.created", (e) => {
    processed.push({ at: new Date().toISOString(), type: e.type, detail: `ユーザー ${String(e.data?.email ?? "?")} を登録` });
  });

async function handlePOST(req: Request): Promise<Response> {
  // **生のボディで検証する。** JSON をパースしてから文字列に戻すと、
  // キーの順序や空白が変わって署名が合わなくなる
  const payload = await req.text();
  const signature = req.headers.get("x-signature") ?? "";

  const result = await receiver.handle(payload, signature);
  return Response.json({
    result,
    processed: processed.slice(-5).reverse(),
  });
}

/** 署名の作り方を画面に見せるため、正しい署名を返す(**デモ専用**)。 */
async function handleGET(req: Request): Promise<Response> {
  const payload = new URL(req.url).searchParams.get("payload") ?? "";
  const { createHmac } = await import("node:crypto");
  return Response.json({ signature: createHmac("sha256", SECRET).update(payload).digest("hex") });
}

export const POST = handleRoute(handlePOST);
export const GET = handleRoute(handleGET);
