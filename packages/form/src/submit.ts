/**
 * 画面から社内 API を呼ぶための薄いラッパ。
 *
 * 【なぜ必要か】
 *
 * 2026-08 の点検で、`internal-app` の **6 画面すべてが素の `fetch` を使い、
 * タイムアウトを 1 つも指定していなかった**。`catch` はあるので画面は落ちないが、
 * **サーバが応答しないと待ち続ける**。
 *
 * 利用者から見ると「ボタンを押しても何も起きない」ので、
 * **もう一度押す**——`withIdempotency` の被覆が 1/15 しかない状態では、
 * それがそのまま**二重登録**になる。
 *
 * 基盤には `@platform/net` の `withTimeout` があったが、繋がれていなかった。
 *
 * 【ここが引き受けること】
 *
 *   1. **タイムアウト**(既定 15 秒)。`AbortSignal` で本当に接続を切る
 *   2. **CSRF ヘッダ**の付与(`csrfHeaders`)——付け忘れると 403 になる
 *   3. **`Content-Type: application/json`**——サーバ側が preflight を要求するため
 *   4. **エラーの整形**——`{ error }` を読んで、画面に出せる文字列にする
 *
 * 【ここが引き受けないこと】
 *
 * **リトライはしない。** 更新系を自動で再送すると二重登録になる。
 * 再試行するかは画面(利用者)が決めること。
 *
 * @example
 * ```ts
 * const res = await submitJson("/api/invoices/123/payment", { amount: 10000 });
 * if (!res.ok) { setError(res.error); return; }
 * setInvoice(res.value);
 * ```
 */
import { csrfHeaders, readCsrfToken } from "./csrf";

/** 呼び出しの結果。**例外を投げない**(画面側で try/catch を書き忘れても落ちない)。 */
export type SubmitResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number };

/** {@link submitJson} の指定。 */
export interface SubmitOptions {
  /** HTTP メソッド(既定 `POST`)。 */
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  /**
   * タイムアウト(ミリ秒。既定 15000)。
   *
   * **15 秒は「利用者が待てる上限」**。これを超えると、
   * 多くの人は再読み込みするか、もう一度ボタンを押す。
   * **長い処理は非同期ジョブにして、画面は受付だけ返すこと**——
   * ここを伸ばしても、待っている人の体験は良くならない。
   */
  timeoutMs?: number;
  /** 追加ヘッダ。 */
  headers?: Record<string, string>;
}

/**
 * 社内 API を呼び、結果を `SubmitResult` で返す。
 *
 * @param path API のパス(`/api/...`)
 * @param body 送る本文(JSON 化される)
 * @param options メソッド・タイムアウトなど
 * @returns 成功なら `{ ok: true, value }`、失敗なら `{ ok: false, error }`
 */
export async function submitJson<T = unknown>(
  path: string,
  body?: unknown,
  options: SubmitOptions = {},
): Promise<SubmitResult<T>> {
  const { method = "POST", timeoutMs = 15_000, headers = {} } = options;

  // **`AbortSignal` を使う。** `withTimeout`(@platform/net)は Promise を
  // 諦めるだけで**接続は残る**——画面から呼ぶ場合、開いたままの接続が
  // 積もると次の要求が詰まる。ここでは本当に切る。
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(path, {
      method,
      // **`Content-Type: application/json` を必ず付ける。**
      // サーバ側(`withApiObservability`)がこれを要求する——
      // 付けないと、他所のページから preflight 無しで投げ込めてしまうため。
      // **トークンは呼ぶたびに cookie から読む。** 使い回すと、
      // セッションが張り直されたあとに古い値を送って 403 になる。
      headers: { "content-type": "application/json", ...csrfHeaders(readCsrfToken()), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });

    // **本文が JSON でないことがある**(502 で HTML が返るなど)。
    // ここで落とすと「画面が真っ白」になるので、読めなければ空として扱う。
    const data: unknown = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        typeof data === "object" && data !== null && typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : `エラーが発生しました（${res.status}）`;
      return { ok: false, error: message, status: res.status };
    }
    return { ok: true, value: data as T };
  } catch (e) {
    // **中断とネットワーク断を区別する。** 「応答がない」と「繋がらない」は
    // 利用者の次の行動が違う(待つ / 通信環境を見る)。
    if (e instanceof DOMException && e.name === "AbortError") {
      return {
        ok: false,
        error: `応答がありません（${Math.floor(timeoutMs / 1000)}秒）。時間をおいてからお試しください。`,
      };
    }
    return { ok: false, error: "通信に失敗しました。ネットワークをご確認ください。" };
  } finally {
    clearTimeout(timer);
  }
}
