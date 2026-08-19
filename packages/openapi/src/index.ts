/**
 * `@platform/openapi` — **API の形を機械が読める文書にする**(OpenAPI 3.1)。
 *
 * ## これは何のためか
 *
 * **別のアプリから叩くため**です。
 *
 * このリポジトリはアプリを別リポジトリに分けています(ADR 0021)。
 * つまり **TypeScript の型を直接 import できません**——
 * `internal-app` の API を `line-console` から叩くとき、
 * リクエストの形は**呼ぶ側が手で書き写す**ことになります。
 *
 * 写した形は**必ずずれます**。ずれても、動かしてみるまで気づきません。
 *
 * OpenAPI 文書があれば:
 *
 * | | |
 * |---|---|
 * | 呼ぶ側 | 文書から**型付きクライアントを生成**できる(手写しをやめられる) |
 * | 提供側 | 変わったことが**差分で見える**(壊す変更に気づける) |
 * | どちらも | 「この API は何を受けるのか」を**コードを読まずに**わかる |
 *
 * ## 使う前に知っておくこと
 *
 * | | |
 * |---|---|
 * | **文書は自動では正しくならない** | ここが作るのは「宣言したもの」の文書です。**宣言し忘れた API は載りません** |
 * | **入力の検証とは別** | 文書に書いても検証はされません。**検証は各ルートで zod を通すこと** |
 * | **公開してよいかは別問題** | 社内向けでも、**認証なしで文書を配ると攻撃対象の一覧**になります。認可の内側に置いてください |
 * | **`z.toJSONSchema` に頼る** | zod v4 の標準機能です。**独自の変換器は書きません**——追随できなくなるため |
 *
 * ## 使い方
 *
 * ```ts
 * import { defineRoute, buildOpenApiDocument } from "@platform/openapi";
 * import { z } from "zod";
 *
 * const createExpense = defineRoute({
 *   method: "post",
 *   path: "/api/expenses",
 *   summary: "経費を登録する",
 *   tags: ["経費"],
 *   body: z.object({ amount: z.number().int(), memo: z.string() }),
 *   response: z.object({ id: z.string() }),
 * });
 *
 * const doc = buildOpenApiDocument({
 *   title: "internal-app",
 *   version: "1.0.0",
 *   routes: [createExpense],
 * });
 * ```
 *
 * @packageDocumentation
 */
import { z } from "zod";

/** HTTP メソッド。 */
export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

/** {@link defineRoute} に渡す定義。 */
export interface RouteDefinition {
  /** HTTP メソッド。 */
  method: HttpMethod;
  /**
   * パス。**Next.js の書き方(`[id]`)ではなく OpenAPI の書き方(`{id}`)**で書く。
   *
   * `[id]` のまま渡された場合は `{id}` に直す(よく間違えるため)。
   */
  path: string;
  /** 一行の説明。**何をするか**を書く。 */
  summary: string;
  /** 詳しい説明(任意)。**なぜそうなっているか**を書く場所。 */
  description?: string;
  /** 分類(画面や業務ごと)。 */
  tags?: string[];
  /** リクエスト本文の形。 */
  body?: z.ZodType;
  /** クエリ文字列の形。**オブジェクトのスキーマ**を渡す。 */
  query?: z.ZodType;
  /** パスパラメータの形。**オブジェクトのスキーマ**を渡す。 */
  params?: z.ZodType;
  /** 成功時(200 / 201)の応答の形。 */
  response?: z.ZodType;
  /**
   * 認証が要るか(既定 true)。
   *
   * **既定を「要る」にしてある。** 書き忘れたときに
   * 「誰でも叩ける」と文書に書かれる方が危ないため。
   */
  auth?: boolean;
  /** この API を叩くのに必要な権限(`@platform/auth` の権限名)。 */
  permission?: string;
}

/** 宣言済みのルート。{@link buildOpenApiDocument} に渡す。 */
export interface Route extends RouteDefinition {
  readonly __brand: "platform-openapi-route";
}

/**
 * ルートを宣言する。
 *
 * **ここでは検証しません。** 文書に載せるための宣言です——
 * 実際の検証は各ルートハンドラで zod を通してください
 * (同じスキーマを使えば、文書と実装がずれません)。
 *
 * @param def ルートの定義
 * @returns 宣言済みルート
 *
 * @example
 * ```ts
 * export const getExpense = defineRoute({
 *   method: "get",
 *   path: "/api/expenses/{id}",
 *   summary: "経費を 1 件取得する",
 *   params: z.object({ id: z.string() }),
 *   response: ExpenseSchema,
 *   permission: "expense:read",
 * });
 * ```
 */
export function defineRoute(def: RouteDefinition): Route {
  return { ...def, path: normalizePath(def.path) } as Route;
}

/**
 * Next.js の動的セグメント(`[id]`)を OpenAPI の書き方(`{id}`)に直す。
 *
 * **間違えたまま気づきにくい**ので、ここで吸収する。
 *
 * @param path パス
 * @returns OpenAPI 形式のパス
 */
function normalizePath(path: string): string {
  return path.replace(/\[(\.{3})?([^\]]+)\]/g, (_m, _spread, name: string) => `{${name}}`);
}

/** {@link buildOpenApiDocument} のオプション。 */
export interface BuildOptions {
  /** API の名前(アプリ名)。 */
  title: string;
  /** 版。**壊す変更をしたら上げる**。 */
  version: string;
  /** 説明(任意)。 */
  description?: string;
  /** 宣言済みのルート。 */
  routes: readonly Route[];
  /**
   * サーバの URL(任意)。
   *
   * **本番の URL を入れないこと**を勧める——文書は社内に配るものなので、
   * 環境ごとに差し替えられる方がよい(呼ぶ側が baseUrl を持つ)。
   */
  servers?: { url: string; description?: string }[];
}

/** 生成した OpenAPI 文書(JSON にしてそのまま配れる)。 */
export type OpenApiDocument = Record<string, unknown>;

/**
 * zod スキーマを JSON Schema に変換する。
 *
 * **zod v4 の `z.toJSONSchema` に任せる。** 独自の変換器は書かない——
 * zod の型は増え続けるので、**追随できなくなり、静かに間違った文書を出す**方が危ない。
 *
 * @param schema zod スキーマ
 * @returns JSON Schema(変換できなければ `{}`)
 */
function toJsonSchema(schema: z.ZodType, where: string, warnings: string[]): Record<string, unknown> {
  // `io: "input"` … **受け取る側の形**を出す。
  // 既定の `"output"` だと `.transform()` の**後**の形になり、
  // **呼ぶ側が送るべき形と食い違う**（`.transform((s) => new Date(s))` を
  // 書いた本文が「Date を送れ」と読める、など）。
  //
  // なお **`z.coerce.number()` はどちらでも `number`** です。
  // クエリは文字列で飛びますが、OpenAPI では**論理的な型で宣言し、
  // 文字列への直列化は呼ぶ側の仕事**なので、これが正しい形です
  try {
    return z.toJSONSchema(schema, { io: "input", target: "draft-2020-12" }) as Record<string, unknown>;
  } catch (inputError) {
    // **`z.preprocess` を含むと `io: "input"` は例外になる**(zod の既知の問題 #4548)。
    // ここで諦めると本文の形が丸ごと空になるので、**出力側の形で代替する**——
    // 変換の前後で形が違う場合はずれるが、**空よりはるかにまし**。
    try {
      const out = z.toJSONSchema(schema, { io: "output", target: "draft-2020-12" }) as Record<string, unknown>;
      warnings.push(`${where}: 入力側の形に変換できず、出力側の形で代用しました(z.preprocess を含む場合に起きます)`);
      return out;
    } catch (outputError) {
      // **黙って空にしない。** 空の形が載った文書は、
      // 「何も送らなくてよい」と読めてしまう
      warnings.push(`${where}: JSON Schema に変換できませんでした(${String(outputError ?? inputError)})`);
      return {};
    }
  }
}

/** オブジェクトの JSON Schema から、パラメータの一覧を作る。 */
function toParameters(
  schema: z.ZodType | undefined,
  location: "query" | "path",
  where: string,
  warnings: string[],
): Record<string, unknown>[] {
  if (schema === undefined) return [];
  const json = toJsonSchema(schema, `${where} (${location})`, warnings);
  const properties = json.properties;
  if (properties === undefined || typeof properties !== "object") return [];
  const required = Array.isArray(json.required) ? (json.required as string[]) : [];
  return Object.entries(properties as Record<string, unknown>).map(([name, propSchema]) => ({
    name,
    in: location,
    // **パスパラメータは必ず必須。** OpenAPI の決まり
    required: location === "path" ? true : required.includes(name),
    schema: propSchema,
  }));
}

/**
 * 宣言済みルートから OpenAPI 3.1 の文書を組み立てる。
 *
 * **同じ `method` と `path` の組は 1 つだけ。** 重複していたら
 * **後から宣言した方が黙って勝つ**のではなく、エラーにする——
 * 文書と実装のずれは、気づかないのが一番まずい。
 *
 * @param options 文書の情報と、載せるルート
 * @returns OpenAPI 文書(`JSON.stringify` してそのまま配れる)
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 同じ method + path が重複している場合
 *
 * @example
 * ```ts
 * const doc = buildOpenApiDocument({ title: "internal-app", version: "1.0.0", routes });
 * return Response.json(doc);
 * ```
 */
export function buildOpenApiDocument(options: BuildOptions): OpenApiDocument {
  const paths: Record<string, Record<string, unknown>> = {};
  const seen = new Set<string>();
  // **変換できなかったものを持ち帰る。** 黙って空のまま出すと、
  // 「何も送らなくてよい API」に見える
  const warnings: string[] = [];

  for (const route of options.routes) {
    const key = `${route.method} ${route.path}`;
    if (seen.has(key)) {
      throw new Error(
        `OpenAPI: 同じ API が 2 回宣言されています: ${key}`
          + "（後から宣言した方が黙って勝つと、文書と実装がずれます）",
      );
    }
    seen.add(key);

    const parameters = [
      ...toParameters(route.params, "path", key, warnings),
      ...toParameters(route.query, "query", key, warnings),
    ];

    const operation: Record<string, unknown> = {
      summary: route.summary,
      ...(route.description !== undefined ? { description: route.description } : {}),
      ...(route.tags !== undefined ? { tags: route.tags } : {}),
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(route.body !== undefined
        ? {
            requestBody: {
              required: true,
              content: { "application/json": { schema: toJsonSchema(route.body, `${key} (body)`, warnings) } },
            },
          }
        : {}),
      responses: {
        [route.method === "post" ? "201" : "200"]: {
          description: "成功",
          ...(route.response !== undefined
            ? { content: { "application/json": { schema: toJsonSchema(route.response, `${key} (response)`, warnings) } } }
            : {}),
        },
        // **失敗の形も書く。** 呼ぶ側は成功だけを見て実装しがちで、
        // 落ちたときに何が返るか分からないと握りつぶす
        "400": { description: "入力が不正" },
        ...((route.auth ?? true) ? { "401": { description: "未認証" } } : {}),
        ...(route.permission !== undefined ? { "403": { description: "権限がない" } } : {}),
      },
      // 既定は「認証が要る」。書き忘れたときに緩い方へ倒さない
      ...((route.auth ?? true) ? { security: [{ session: [] }] } : { security: [] }),
      ...(route.permission !== undefined
        ? { "x-required-permission": route.permission }
        : {}),
    };

    // **一度変数に受ける。** `paths[route.path] ??= {}` の直後でも、
    // `noUncheckedIndexedAccess` では**添字アクセスの結果は毎回 undefined を含む**
    // ——`??=` で入れたことを型は覚えてくれない。
    const byMethod = (paths[route.path] ??= {});
    byMethod[route.method] = operation;
  }

  return {
    openapi: "3.1.0",
    // **変換できなかったところを文書に残す。** 読む人が
    // 「ここは当てにならない」と分かるようにする(空の形は嘘になりうる)
    ...(warnings.length > 0 ? { "x-generation-warnings": warnings } : {}),
    info: {
      title: options.title,
      version: options.version,
      ...(options.description !== undefined ? { description: options.description } : {}),
    },
    ...(options.servers !== undefined ? { servers: options.servers } : {}),
    paths,
    components: {
      securitySchemes: {
        // このリポジトリの API はセッションクッキーで守っている
        session: { type: "apiKey", in: "cookie", name: "session" },
      },
    },
  };
}
