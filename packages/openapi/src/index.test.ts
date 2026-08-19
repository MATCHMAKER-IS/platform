import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineRoute, buildOpenApiDocument } from "./index";

describe("defineRoute", () => {
  // **Next.js の書き方のまま渡しがち。** 間違えても動いてしまい、
  // 生成された文書だけが静かに壊れる
  it("Next の [id] を OpenAPI の {id} に直す", () => {
    const r = defineRoute({ method: "get", path: "/api/items/[code]", summary: "1 件取得" });
    expect(r.path).toBe("/api/items/{code}");
  });

  it("catch-all([...slug])も直す", () => {
    const r = defineRoute({ method: "get", path: "/api/docs/[...slug]", summary: "取得" });
    expect(r.path).toBe("/api/docs/{slug}");
  });
});

describe("buildOpenApiDocument", () => {
  const routes = [
    defineRoute({
      method: "post",
      path: "/api/expenses",
      summary: "経費を登録する",
      tags: ["経費"],
      body: z.object({ amount: z.number().int(), memo: z.string().optional() }),
      response: z.object({ id: z.string() }),
      permission: "expense:write",
    }),
    defineRoute({
      method: "get",
      path: "/api/expenses/[id]",
      summary: "経費を 1 件取得する",
      params: z.object({ id: z.string() }),
      query: z.object({ detail: z.string().optional() }),
      response: z.object({ id: z.string(), amount: z.number() }),
    }),
  ];

  const doc = buildOpenApiDocument({ title: "internal-app", version: "1.0.0", routes }) as {
    openapi: string;
    paths: Record<string, Record<string, { [k: string]: unknown }>>;
  };

  it("OpenAPI 3.1 の形になる", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths).sort()).toEqual(["/api/expenses", "/api/expenses/{id}"]);
  });

  it("本文のスキーマが JSON Schema に変換される", () => {
    const body = doc.paths["/api/expenses"]!.post!.requestBody as {
      content: { "application/json": { schema: { properties: Record<string, unknown>; required?: string[] } } };
    };
    const schema = body.content["application/json"].schema;
    expect(Object.keys(schema.properties).sort()).toEqual(["amount", "memo"]);
    // optional は required に入らない
    expect(schema.required).toEqual(["amount"]);
  });

  it("パスパラメータは必ず required になる", () => {
    const params = doc.paths["/api/expenses/{id}"]!.get!.parameters as {
      name: string; in: string; required: boolean;
    }[];
    const id = params.find((p) => p.name === "id");
    expect(id).toMatchObject({ in: "path", required: true });
    // クエリの optional は required にならない
    expect(params.find((p) => p.name === "detail")).toMatchObject({ in: "query", required: false });
  });

  // **書き忘れたときに緩い方へ倒さない。** 「誰でも叩ける」と
  // 文書に書かれる方が危ない
  it("auth を書かなければ「認証が要る」になる", () => {
    expect(doc.paths["/api/expenses"]!.post!.security).toEqual([{ session: [] }]);
    expect((doc.paths["/api/expenses"]!.post!.responses as Record<string, unknown>)["401"]).toBeDefined();
  });

  it("auth: false なら security は空", () => {
    const open = buildOpenApiDocument({
      title: "x", version: "1", routes: [
        defineRoute({ method: "get", path: "/api/health", summary: "死活", auth: false }),
      ],
    }) as { paths: Record<string, Record<string, Record<string, unknown>>> };
    expect(open.paths["/api/health"]!.get!.security).toEqual([]);
    expect((open.paths["/api/health"]!.get!.responses as Record<string, unknown>)["401"]).toBeUndefined();
  });

  it("必要な権限を x-required-permission に出す", () => {
    expect(doc.paths["/api/expenses"]!.post!["x-required-permission"]).toBe("expense:write");
  });

  // **失敗の形が書いていないと、呼ぶ側は成功だけを見て実装する**
  it("400 を必ず載せる", () => {
    expect((doc.paths["/api/expenses"]!.post!.responses as Record<string, unknown>)["400"]).toBeDefined();
  });

  // **後から宣言した方が黙って勝つ**と、文書と実装がずれる
  it("同じ method + path を 2 回宣言したらエラー", () => {
    const dup = [
      defineRoute({ method: "get", path: "/api/x", summary: "a" }),
      defineRoute({ method: "get", path: "/api/x", summary: "b" }),
    ];
    expect(() => buildOpenApiDocument({ title: "x", version: "1", routes: dup })).toThrow(/2 回宣言/);
  });

  // **クエリの数値は `number` で出す。**
  //
  // 2026-08 に「クエリ文字列だから `string` で出すべき」と書いた試験があり、
  // **こちらが間違っていました**。OpenAPI のクエリは
  // **論理的な型で宣言し、文字列への直列化は呼ぶ側の仕事**です
  // ——`type: integer` のページ番号は、どの API 文書にもある普通の形。
  // `string` で出すと、生成されたクライアントが `page?: string` になり、
  // **呼ぶ側が毎回 String() を書く**ことになります。
  it("z.coerce の数値はクエリでも number で出す", () => {
    const open = buildOpenApiDocument({
      title: "x", version: "1", routes: [
        defineRoute({
          method: "get", path: "/api/y", summary: "y",
          query: z.object({ page: z.coerce.number() }),
        }),
      ],
    }) as { paths: Record<string, Record<string, { parameters: { name: string; schema: { type?: string } }[] }>> };
    const page = open.paths["/api/y"]!.get!.parameters.find((p) => p.name === "page");
    expect(page?.schema.type).toBe("number");
  });
});
