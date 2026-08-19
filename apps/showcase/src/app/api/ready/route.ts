// public-api: 起動確認。ロードバランサから認可なしで叩けることが要件
// no-rate-limit: 死活監視は数十秒ごとに叩かれるのが要件。制限すると監視そのものが落ちる
/**
 * 受け入れられるか(ready)。
 *
 * **health との違い**は、「動いている」ではなく
 * 「利用者を振り分けてよいか」を答えること。
 * 起動中にリクエストが来ると、利用者はエラー画面を見る。
 *
 * showcase は外部の保存先を持たないので、
 * **ページが組み上がっていれば受け入れてよい**。
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ status: "ready" });
}
