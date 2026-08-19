/**
 * OpenAPI 文書に載せる API の一覧。
 *
 * 【なぜ 1 か所に集めるか】
 * **宣言はハンドラと同じファイルに置きます**（離すと片方だけ直される）。
 * ただし文書を組み立てるには全部を集める必要があるので、
 * **ここが唯一の集約点**になります。
 *
 * 【足すとき】
 * 1. ルートのファイルで `export const spec = defineRoute({ … })` を書く
 * 2. ここに import を 1 行足す
 *
 * **忘れても動きます。** 動くけれど、**別のアプリからは見えません**——
 * `check-openapi-coverage` が「宣言していない API」を数えて、
 * 増えたら落とします（上限ラチェット）。
 *
 * 【載せてよいかの判断】
 * **社内の別アプリから叩くもの**だけを載せてください。
 * 画面専用の API（その画面からしか呼ばれない）まで載せると、
 * **一覧が大きくなって、本当に使ってよいものが埋もれます**。
 *
 * このアプリでは `/api/items` の一覧だけを載せています——
 * **書き方の見本**であり、「全部載せる」という意味ではありません。
 *
 * @packageDocumentation
 */
import { buildOpenApiDocument, type Route } from "@platform/openapi";

import { spec as itemsList } from "../app/api/items/spec";

/**
 * 文書に載せる API。
 *
 * **順番は意味を持ちません**（パスで整列して出ます）。
 */
export const routes: Route[] = [
  itemsList,
];

/**
 * OpenAPI 文書を組み立てる。
 *
 * **`servers` は入れません。** 環境ごとに URL が違うので、
 * **呼ぶ側が baseUrl を持つ**方がよい——文書に本番の URL を焼き込むと、
 * **検証環境から本番を叩く事故**が起きます。
 *
 * @returns OpenAPI 3.1 の文書
 */
export function buildSpec(): Record<string, unknown> {
  return buildOpenApiDocument({
    title: "品目マスタ API",
    version: "1.0.0",
    routes,
  });
}
