/**
 * OpenAPI 文書を配る（`GET /api/openapi.json`）。
 *
 * **認可の内側に置いてあります。** 社内向けでも、認証なしで配ると
 * **攻撃対象の一覧**になります——どの API があり、何を受け取るかが全部書いてあります。
 *
 * 呼ぶ側は、これを取って型付きクライアントを生成します:
 *
 * ```bash
 * npx openapi-typescript http://your-app.local/api/openapi.json \
 *   -o src/generated/your-app.d.ts
 * ```
 *
 * **生成物はコミットしてください。** 相手が落ちているとビルドできない、を避けます。
 *
 * 【なぜ雛形に入っているか】
 * アプリは別リポジトリになるので、**TypeScript の型を直接 import できません**
 * （ADR 0021）。呼ぶ側が形を手で書き写すと**必ずずれます**——
 * 直したつもりで片方だけ古いまま、という形で。
 */
import { currentUser, requirePermission } from "../../../server/authorize";
import { withApi } from "../../../server/instrument";
import { buildSpec } from "../../../server/api-spec";

export const GET = withApi("/api/openapi.json", async (req: Request) => {
  // **管理者だけに配る。** 一覧そのものが情報なので、全社員には配りません。
  // 呼ぶ側のアプリには**専用の利用者**を作ってください
  requirePermission(currentUser(req), "system:manage");
  return Response.json(buildSpec());
});
