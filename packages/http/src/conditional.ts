/**
 * API の作法をまとめたもの。
 *
 * 【なぜ基盤に置くか】
 * どれも**どのアプリでも同じように必要**で、
 * かつ**間違えると分かりにくい形で壊れる**。
 *
 * - ETag を返さないと、一覧を開くたびに全件を送り直す
 * - 冪等キーが無いと、通信が切れた再送で二重に登録される
 * - `Retry-After` が無いと、いつ再開してよいか分からない
 * @packageDocumentation
 */
import { createHash } from "node:crypto";

/**
 * 中身から ETag を作る。
 *
 * **弱い ETag(`W/`)にする。**
 * バイト単位で同じことは保証せず、「内容が同じ」だけを示す。
 * JSON のキー順が変わっても同じ値になってほしい場面が多く、
 * 強い ETag は範囲リクエストと組で使うもの。
 *
 * @param body 対象(文字列か、JSON にできる値)
 * @returns `W/"..."` 形式の ETag
 *
 * @example
 * ```ts
 * const items = await store.list();
 * const etag = makeETag(items);
 * if (notModified(req, etag)) return new Response(null, { status: 304 });
 * return Response.json(items, { headers: { etag } });
 * ```
 */
export function makeETag(body: string | unknown): string {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const hash = createHash("sha256").update(text).digest("base64url").slice(0, 27);
  return `W/"${hash}"`;
}

/**
 * 送られてきた ETag と一致するか(= 変わっていないか)。
 *
 * **一致したら 304 を返し、本文を送らない。**
 * 一覧を開くたびに全件を送るのは、件数が増えるほど効く無駄になる。
 *
 * `If-None-Match` は複数の値をカンマで並べられる。
 * `*` はどんな値とも一致する(仕様)。
 *
 * @param req 要求
 * @param etag 今の ETag
 * @returns 変わっていなければ true
 */
export function notModified(req: Request, etag: string): boolean {
  const header = req.headers.get("if-none-match");
  if (header === null) return false;
  if (header.trim() === "*") return true;
  // **`W/` の有無を無視して比べる。**
  // 送り返すときに落とすプロキシがある
  const normalize = (v: string) => v.trim().replace(/^W\//, "");
  return header.split(",").some((v) => normalize(v) === normalize(etag));
}

/**
 * 冪等キーの保管。
 *
 * **同じキーの要求は、最初の結果を返す。**
 * 通信が切れて再送されたとき、二重に登録しないため。
 */
export interface IdempotencyStore {
  /** 記録済みの応答を取り出す。 */
  get(key: string): Promise<{ status: number; body: string } | undefined>;
  /** 応答を記録する。 */
  set(key: string, value: { status: number; body: string }): Promise<void>;
}

/**
 * メモリ実装。
 *
 * **本番では Redis などに差し替える。**
 * インスタンスが複数あると、各々が別に覚えることになり、
 * 二重登録を防げない。
 *
 * @param ttlMs 覚えておく時間(既定 24 時間)
 * @returns 保管
 */
export function createMemoryIdempotencyStore(ttlMs = 24 * 60 * 60 * 1000): IdempotencyStore {
  const map = new Map<string, { at: number; value: { status: number; body: string } }>();
  return {
    async get(key) {
      const hit = map.get(key);
      if (hit === undefined) return undefined;
      // **期限切れは無いものとして扱う。** 古い結果を返し続けない
      if (Date.now() - hit.at > ttlMs) { map.delete(key); return undefined; }
      return hit.value;
    },
    async set(key, value) {
      map.set(key, { at: Date.now(), value });
    },
  };
}

/** {@link withIdempotency} の設定。 */
export interface IdempotencyOptions {
  store: IdempotencyStore;
  /**
   * キーの前に付ける文字列。
   *
   * **利用者ごとに分ける。** 分けないと、
   * 他人が同じキーを送ったときに他人の結果が返る。
   */
  scope: string;
}

/**
 * 冪等キーがあれば、同じ要求を 1 回だけ実行する。
 *
 * **キーが無ければそのまま実行する。**
 * 必須にすると、既存のクライアントが全部動かなくなる。
 * 二重登録が困る操作(決済・発注)から順に付けてもらう。
 *
 * @param req 要求
 * @param options 保管と範囲
 * @param handler 本来の処理
 * @returns 応答
 *
 * @example
 * ```ts
 * export const POST = (req: Request) =>
 *   withIdempotency(req, { store, scope: user.email }, async () => {
 *     const order = await createOrder(await req.json());
 *     return Response.json(order, { status: 201 });
 *   });
 * ```
 */
export async function withIdempotency(
  req: Request,
  options: IdempotencyOptions,
  handler: () => Promise<Response>,
): Promise<Response> {
  const key = req.headers.get("idempotency-key");
  if (key === null || key.trim() === "") return handler();

  const full = `${options.scope}:${key.trim()}`;
  const saved = await options.store.get(full);
  if (saved !== undefined) {
    // **同じ結果を返す。** 「もう処理済み」ではなく、最初の応答をそのまま
    return new Response(saved.body, {
      status: saved.status,
      headers: { "content-type": "application/json", "idempotent-replay": "true" },
    });
  }

  const res = await handler();
  // **失敗は覚えない。** 直してから送り直せるようにする
  if (res.status >= 200 && res.status < 300) {
    const body = await res.clone().text();
    await options.store.set(full, { status: res.status, body });
  }
  return res;
}

/**
 * 「あとで試して」を伝える応答を作る。
 *
 * **いつ再開してよいかを書く。**
 * 「失敗しました」だけでは、クライアントが即座に再送して
 * さらに混雑させる。
 *
 * @param seconds 何秒後に試してよいか
 * @param message 利用者に見せる文言
 * @returns 429 の応答
 */
export function tooManyRequests(seconds: number, message = "操作が多すぎます。しばらくしてからお試しください"): Response {
  return Response.json(
    { error: message },
    { status: 429, headers: { "retry-after": String(Math.max(1, Math.floor(seconds))) } },
  );
}

/**
 * 一時的に受けられないことを伝える。
 *
 * **メンテナンスや過負荷のとき。**
 * 500 と違い、**時間を置けば直る**ことが伝わる。
 *
 * @param seconds 何秒後に試してよいか
 * @param message 文言
 * @returns 503 の応答
 */
export function serviceUnavailable(seconds: number, message = "ただいま受け付けられません。しばらくしてからお試しください"): Response {
  return Response.json(
    { error: message },
    { status: 503, headers: { "retry-after": String(Math.max(1, Math.floor(seconds))) } },
  );
}
