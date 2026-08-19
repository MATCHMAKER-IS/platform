/**
 * この API の OpenAPI 宣言。
 *
 * 【なぜ `route.ts` から出したか】
 * **App Router のルートは決まった名前しか export できません**
 * （`GET` / `POST` / `runtime` / `config` …）。`spec` を足すと
 * `next build` の型検査が **`Type 'Route' is not assignable to type 'never'`**
 * で落ちます（Next 15 で顕在化。2026-08）。
 *
 * **同じフォルダに置く**ことで、離した弊害——片方だけ直される——は
 * 抑えています。**ハンドラを変えたら、隣のこのファイルも見てください。**
 *
 * @packageDocumentation
 */
import { defineRoute } from "@platform/openapi";
import { z } from "zod";

/**
 * 受け取るクエリ。
 *
 * **文書と実装で同じものを使う。** 別々に書くと、
 * 直したつもりで**文書だけが嘘になる**——`page` の上限を変えたのに
 * 文書には古い値が残る、という形で必ず起きます。
 */
export const Query = z.object({
  includeInactive: z.enum(["0", "1"]).optional(),
  keyword: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  // **上限 100 は実装と揃える。** ここだけ緩いと、
  // 呼ぶ側が「200 まで行ける」と読んで実装で切られます
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * 一覧の OpenAPI 宣言。
 *
 * **ハンドラと同じファイルに置く**——離すと片方だけ直されます
 * （`server/api-spec.ts` が集めて配ります）。
 *
 * **雛形にこれを入れてある理由**: 新しいアプリを作った人が
 * 「どう書くか」をコピーできるようにするためです。
 * **外から叩かれない API まで宣言する必要はありません**——
 * 一覧が大きくなると、本当に使ってよいものが埋もれます。
 */
export const spec = defineRoute({
  method: "get",
  path: "/api/items",
  summary: "品目の一覧を取得する（コード順・ページ単位）",
  tags: ["品目"],
  query: Query,
  response: z.object({
    items: z.array(z.object({
      code: z.string(),
      name: z.string(),
      note: z.string().optional(),
      active: z.boolean(),
      createdAt: z.string(),
    })),
    /** 絞り込み後の総件数（**全データの件数ではない**）。 */
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
    /** 総ページ数（**0 件でも 1**）。 */
    pageCount: z.number().int(),
  }),
});
