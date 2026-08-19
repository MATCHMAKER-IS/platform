import { AppError, ErrorCode, err, ok, type Result } from "@platform/core";
import { estimateMessagesTokens, estimateTokens } from "./tokens";
import type { AiCallLog, AiChatRequest, AiChatSuccess, AiLogStore, AiMessage, AiPrice, AiProvider, AiStreamChunk } from "./types";

/** Gateway の設定。 */
export interface AiGatewayOptions {
  providers: AiProvider[];
  defaultModel: string;
  /** モデル名→プロバイダ id の明示ルート(models / 接頭辞より優先)。 */
  routes?: Record<string, string>;
  /** モデル別料金。未登録モデルは costJpy を付けない。 */
  pricing?: Record<string, AiPrice>;
  limits?: {
    /** 1回の生成トークン上限(既定 1024)。リクエスト値はこの値で丸める。 */
    maxTokensPerCall?: number;
    /** 累積(入+出)トークンの予算。超過後の呼び出しは拒否。 */
    maxTotalTokens?: number;
  };
  /**
   * **一時的な失敗のときの試し直し**（任意）。
   *
   * `attempts` … 試す回数（既定 2）。**AI は 1 回が高い**ので増やしすぎないこと。
   * `baseMs` … 最初の待ち時間（既定 500ms）。回を追うごとに延び、ばらつきも入ります。
   */
  retry?: {
    attempts?: number;
    baseMs?: number;
  };
  /** ルーティング先が失敗したら残りのプロバイダを順に試す(既定 false)。 */
  fallback?: boolean;
  /** ログ保存前にプロンプトへ適用するマスク(PII 伏せなど)。 */
  redact?: (text: string) => string;
  /** 直近の user メッセージをログへ残す(既定 false。残す場合も redact 適用)。 */
  logPrompt?: boolean;
  logStore?: AiLogStore;
  now?: () => number;
}

/** AI Gateway。 */
export interface AiGateway {
  chat(req: AiChatRequest): Promise<Result<AiChatSuccess>>;

  /**
   * **少しずつ受け取る**（ストリーミング）。
   *
   * 【なぜ要るか】
   * AI の返事は**数秒〜数十秒**かかります。その間**画面が止まって見える**と、
   * **利用者は壊れたと思って何度も押します**——同じ質問が 3 回投げられ、
   * **請求も 3 倍**になります。
   *
   * 少しずつ出せば「**動いている**」と分かるので、待てます。
   *
   * 【必ず知っておくこと】
   * **① 費用は途中で止めても掛かります。** 利用者が画面を閉じても、
   * **そこまでに生成された分**は請求されます——
   * 「途中でやめれば安い」ではありません。
   *
   * **② 記録は最後にまとめて残ります。** 途中で切れると
   * **使用量が記録されない**ことがあります——
   * **予算の管理は「送る前の見積もり」**（`estimateTokens`）に頼ってください。
   *
   * **③ 上限の判定は最初だけ**です。走り出したあとに予算を超えても止まりません。
   *
   * 【使い方】
   * ```ts
   * for await (const chunk of gateway.stream({ messages })) {
   *   if (chunk.type === "text") process.stdout.write(chunk.text);
   *   if (chunk.type === "done") console.log("\n", chunk.usage);
   * }
   * ```
   *
   * @param req 通常の `chat` と同じ
   * @returns 少しずつ届く塊。**最後に必ず `done` が 1 つ**来ます
   */
  stream(req: AiChatRequest): AsyncIterable<AiStreamChunk>;
  /** これまでに消費した累積トークン(入+出)。 */
  totalTokens(): number;
}

const PREFIX_ROUTES: readonly (readonly [string, string])[] = [
  ["claude", "anthropic"],
  ["gpt", "openai"],
  ["o1", "openai"],
  ["gemini", "google"],
];


/**
 * AI の呼び出しを**一時的な失敗のときだけ試し直す**。
 *
 * 【何を試し直すか】
 * **混雑（429）と一時的な不調（503 / タイムアウト）だけ**です。
 * **入力が不正（400）や認証エラー（401）は繰り返しても無駄**なので、
 * すぐ諦めます——`isRetryable` がその判断をします。
 *
 * 【なぜ待つか】
 * **待たずに繰り返すと、相手の混雑を悪化させます。**
 * 回を追うごとに待ち時間を延ばし、**ばらつき（jitter）も入れます**
 * ——全員が同じ秒数で再開すると、**また一斉に混みます**。
 *
 * 【既定は 2 回まで】
 * **AI は 1 回が高い**ので、闇雲に繰り返すと**請求が増えます**。
 * 3 回目で駄目なら、次のプロバイダへ移る方が確かです。
 *
 * @param call 呼び出し
 * @param options `attempts`（試す回数。既定 2）と `baseMs`（最初の待ち時間。既定 500）
 * @returns 呼び出しの結果
 * @throws 試し直しても駄目だった場合、**最後のエラー**をそのまま投げます
 */
/**
 * 待ち時間を出す（回を追うごとに延ばし、ばらつきを入れる）。
 *
 * **`@platform/net` の `backoffDelay` と同じ計算**ですが、
 * **`ai` から `net` へ依存を増やさない**ためにここに置いています
 * （smoke が `ai` を 8 箇所から読んでおり、依存が増えると差し替えも 8 箇所要ります）。
 *
 * **ばらつき（jitter）を必ず入れてください。** 入れないと、
 * **混雑で失敗した全員が同じ秒数で再開し、また一斉に混みます**。
 *
 * @param attempt 何回目か（0 始まり）
 * @param baseMs 最初の待ち時間
 * @returns 待つミリ秒
 */
/**
 * **試し直す価値があるエラーか**を見る。
 *
 * **混雑（429）と一時的な不調（500 / 502 / 503 / 504）、通信の切断だけ**です。
 * **入力が不正（400）や認証エラー（401 / 403）は繰り返しても無駄**なので、
 * すぐ諦めます——**繰り返すほど請求が増えるだけ**です。
 *
 * **`@platform/core` の `isRetryable` を使わない理由**:
 * あちらは `AppError` の分類で判断しますが、**AI プロバイダが投げるのは
 * 生の `Error`** です（SDK や `fetch` の失敗）。ここでは
 * **ステータス番号と文言**で見ます。
 *
 * **分からないものは試し直しません**（安全側）——
 * 何が起きたか分からないまま繰り返すのが一番危ないためです。
 *
 * @param error 起きたエラー
 * @returns 試し直す価値があれば true
 */
function isTransientAiError(error: unknown): boolean {
  const status = (error as { status?: number; statusCode?: number } | null)?.status
    ?? (error as { statusCode?: number } | null)?.statusCode;
  if (typeof status === "number") {
    return status === 429 || (status >= 500 && status < 600);
  }
  const message = error instanceof Error ? error.message : String(error);
  // **通信の切断・タイムアウト**は試し直す価値がある
  return /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|timeout|aborted|fetch failed/i
    .test(message);
}

function aiBackoffDelay(attempt: number, baseMs: number): number {
  const raw = Math.min(10_000, baseMs * 2 ** attempt);
  // **±25% のばらつき**を入れる
  const delta = raw * 0.25;
  return Math.round(raw - delta + Math.random() * delta * 2);
}

async function withAiRetry<T>(
  call: () => Promise<T>,
  options: { attempts?: number; baseMs?: number } = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 2);
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await call();
    } catch (e) {
      lastError = e;
      // **繰り返しても無駄なものは、その場で諦める**
      if (!isTransientAiError(e)) throw e;
      // **最後の 1 回なら待たない**（待ってから投げても意味がない）
      if (i === attempts - 1) break;
      const wait = aiBackoffDelay(i, options.baseMs ?? 500);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError;
}

/**
 * AI Gateway を作る。
 *
 * **アプリは各社の SDK を直接使わない**(ADR 0010)。ここを通すことで:
 * - **モデルを差し替えられる**(Claude → GPT を設定だけで)
 * - **コストを追跡できる**(全呼び出しがログに残る)
 * - **上限を設けられる**(暴走を止める)
 *
 * @param options.providers プロバイダの配列(Anthropic / OpenAI など)
 * @param options.logStore ログの保存先
 * @param options.limits 呼び出しの上限(任意)
 * @returns Gateway。`chat` で呼ぶ
 */
export function createAiGateway(options: AiGatewayOptions): AiGateway {
  const maxPerCall = options.limits?.maxTokensPerCall ?? 1024;
  const maxTotal = options.limits?.maxTotalTokens;
  const now = options.now ?? (() => Date.now());
  let total = 0;
  const byId = new Map(options.providers.map((p) => [p.id, p]));

  const resolveProvider = (model: string): AiProvider | undefined => {
    const routed = options.routes?.[model];
    if (routed) return byId.get(routed);
    for (const p of options.providers) {
      if (p.models?.some((m) => model === m || model.startsWith(m))) return p;
    }
    for (const [prefix, id] of PREFIX_ROUTES) {
      if (model.startsWith(prefix) && byId.has(id)) return byId.get(id);
    }
    return options.providers[0];
  };

  const record = (entry: AiCallLog): void => {
    if (!options.logStore) return;
    try {
      void Promise.resolve(options.logStore.add(entry)).catch(() => {});
    } catch {
      // ログ失敗で本流を落とさない
    }
  };

  const promptOf = (messages: AiMessage[]): string | undefined => {
    if (!options.logPrompt) return undefined;
    const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    return options.redact ? options.redact(last) : last;
  };

  return {
    totalTokens: () => total,
    async chat(req) {
      if (req.messages.length === 0 || req.messages.every((m) => m.content.trim() === "")) {
        return err(new AppError(ErrorCode.VALIDATION, "messages が空です"));
      }
      const model = req.model ?? options.defaultModel;
      // **送る前に見積もって止める。** 実績の累計だけで見ていると、
      // **残り 100 トークンでも 10 万トークンの入力を送れて**しまい、
      // 止まるのは**次の呼び出しから**——その 1 回分の請求は防げません。
      //
      // 見積もりは**多めに出す**ようにしてあるので、
      // **本当は収まるのに断る**ことはありますが、**超えて送るよりは安全**です。
      // **1 回で予算を使い切る入力を断る。**
      // 累計だけで見ていると、**残り 100 トークンでも 10 万トークンの入力を
      // 送れて**しまい、止まるのは**次の呼び出しから**——その 1 回分の請求は防げません。
      //
      // **累計との合算では見ません。** 「あと少しで上限」のときに
      // **普通の質問まで断る**と使えなくなるためです。
      // ここで断るのは**1 回だけで予算を超える入力**に限ります。
      if (maxTotal !== undefined) {
        const estimate = estimateMessagesTokens(req.messages);
        if (estimate > maxTotal) {
          return err(new AppError(
            ErrorCode.RATE_LIMITED,
            `入力が大きすぎます（見積もり ${estimate} トークン / 予算 ${maxTotal}）`,
          ));
        }
      }
      if (maxTotal !== undefined && total >= maxTotal) {
        return err(new AppError(ErrorCode.RATE_LIMITED, `AI トークン予算(${maxTotal})を超過しています`, { details: { totalTokens: total } }));
      }
      const first = resolveProvider(model);
      if (!first) {
        return err(new AppError(ErrorCode.CONFIG, `モデル ${model} を扱うプロバイダが登録されていません`));
      }
      const maxTokens = Math.min(req.maxTokens ?? maxPerCall, maxPerCall);
      const candidates = options.fallback ? [first, ...options.providers.filter((p) => p !== first)] : [first];
      const prompt = promptOf(req.messages);
      let lastError = "";

      for (const provider of candidates) {
        const t0 = now();
        try {
          // **一時的な失敗は少し待って試し直す。** 混雑（429）や
          // 一時的な不調（503）は**数秒待てば通る**ことが多く、
          // すぐ別のプロバイダへ移ると**得意なモデルを諦める**ことになります。
          //
          // **待たずに繰り返さないこと**——相手の混雑を悪化させます。
          // `backoffDelay` が**回を追うごとに待ち時間を延ばし、ばらつきも入れます**
          // （全員が同じ秒数で再開すると、また一斉に混みます）。
          //
          // **再試行しても駄目なら、次のプロバイダへ**（既存のフォールバック）。
          const r = await withAiRetry(
            () => provider.chat({ model, messages: req.messages, maxTokens, ...(req.tools === undefined ? {} : { tools: req.tools }) }),
            options.retry,
          );
          const latencyMs = now() - t0;
          total += r.usage.inputTokens + r.usage.outputTokens;
          const price = options.pricing?.[model];
          const costJpy = price ? (r.usage.inputTokens / 1000) * price.inJpyPer1k + (r.usage.outputTokens / 1000) * price.outJpyPer1k : undefined;
          record({ at: new Date(now()).toISOString(), provider: provider.id, model, ...(req.user ? { user: req.user } : {}), ok: true, latencyMs, usage: r.usage, ...(costJpy !== undefined ? { costJpy } : {}), ...(prompt !== undefined ? { prompt } : {}) });
          return ok({ text: r.text, ...(r.toolCalls === undefined ? {} : { toolCalls: r.toolCalls }), model, provider: provider.id, usage: r.usage, latencyMs, ...(costJpy !== undefined ? { costJpy } : {}) });
        } catch (e) {
          const latencyMs = now() - t0;
          lastError = e instanceof Error ? e.message : String(e);
          record({ at: new Date(now()).toISOString(), provider: provider.id, model, ...(req.user ? { user: req.user } : {}), ok: false, latencyMs, error: lastError, ...(prompt !== undefined ? { prompt } : {}) });
        }
      }
      return err(new AppError(ErrorCode.EXTERNAL, `AI 呼び出しに失敗しました: ${lastError}`, { details: { model } }));
    },

    async *stream(req) {
      // **上限の判定は最初だけ。** 走り出したあとに予算を超えても止まりません
      // ——**送る前の見積もり**で防ぐ設計です。
      if (maxTotal !== undefined) {
        const estimate = estimateMessagesTokens(req.messages);
        if (estimate > maxTotal) {
          yield { type: "done", error: `入力が大きすぎます（見積もり ${estimate} トークン）` };
          return;
        }
      }

      const model = req.model ?? options.defaultModel;
      const provider = resolveProvider(model);
      if (provider === undefined) {
        yield { type: "done", error: `モデル ${model} を扱うプロバイダが登録されていません` };
        return;
      }
      if (provider.stream === undefined) {
        // **ストリーミングに対応していない提供者もあります。**
        // その場合は**普通に呼んで、まとめて 1 回で返します**
        // ——**呼び出し側は同じ書き方のままで済みます**（分岐が要りません）。
        const r = await this.chat(req);
        if (!r.ok) {
          yield { type: "done", error: r.error.message };
          return;
        }
        yield { type: "text", text: r.value.text };
        yield { type: "done", usage: r.value.usage };
        return;
      }

      const maxTokens = Math.min(req.maxTokens ?? maxPerCall, maxPerCall);
      let outputTokens = 0;
      try {
        for await (const chunk of provider.stream({
          model, messages: req.messages, maxTokens,
        })) {
          if (chunk.type === "text") {
            // **粗く数えておく。** 提供者が使用量をくれないことがあるので、
            // **後で「いくら使ったか分からない」**にならないようにします。
            outputTokens += estimateTokens(chunk.text);
            yield chunk;
          } else {
            total += (chunk.usage?.inputTokens ?? 0) + (chunk.usage?.outputTokens ?? outputTokens);
            yield chunk;
            return;
          }
        }
        // **提供者が `done` を出さずに終わることがあります。**
        // **必ず 1 つ返す**と約束しているので、ここで補います
        // ——無いと**呼び出し側が待ち続けます**。
        yield { type: "done", usage: { inputTokens: 0, outputTokens } };
      } catch (e) {
        // **途中で切れても `done` は返します。**
        // 例外だけ投げると、**呼び出し側の `for await` が
        // 「終わったのか失敗したのか」分からないまま抜けます**。
        yield { type: "done", error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}
