/**
 * 送る前に**トークン数を見積もる**。
 *
 * 【なぜ必要か】
 * 上限は**実績の累計**で見ているので、**残り 100 トークンでも
 * 10 万トークンの入力を送れて**しまいます——止まるのは**次の呼び出しから**で、
 * **その 1 回分の請求は防げません**。
 *
 * 送る前に見積もれば、**上限を超える呼び出しを最初から断れます**。
 *
 * 【精度】
 * **正確な数ではありません。** 提供者ごとに数え方が違い、
 * 本当の数は**送ってみないと分かりません**。ここでは次の目安を使います:
 *
 * | 文字 | 1 トークンあたり |
 * |---|---|
 * | 日本語（漢字・かな） | **約 0.7 文字** |
 * | 英数字・記号 | 約 4 文字 |
 *
 * **日本語は英語より多くのトークンを使います**——同じ文字数でも
 * **5 倍以上**になることがあります。「短い文章だから安い」とは限りません。
 *
 * **少なめに見積もらないこと。** 少なく見ると上限を超えて送ってしまうので、
 * **多めに出る**ようにしてあります。
 *
 * @param text 送る文章
 * @returns 見積もったトークン数（**多め**）
 */
export function estimateTokens(text: string): number {
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    // **日本語・中国語・韓国語の文字**（かな・漢字・ハングル・全角記号）
    if (/[\u3000-\u30ff\u3400-\u9fff\uf900-\ufaff\uff00-\uffef\uac00-\ud7af]/.test(ch)) cjk += 1;
    else other += 1;
  }
  // **切り上げる。** 少なく見ると上限を超えて送ってしまう
  return Math.ceil(cjk / 0.7) + Math.ceil(other / 4);
}

/**
 * やり取り全体のトークン数を見積もる。
 *
 * **役割名（`user` / `assistant`）と区切りにも数トークン**かかるので、
 * 1 件あたり 4 トークンを足しています。
 *
 * @param messages 送るやり取り
 * @returns 見積もったトークン数（**多め**）
 */
export function estimateMessagesTokens(
  messages: readonly { content: string }[],
): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
}

/**
 * AI の出力から **JSON を取り出す**。
 *
 * 【なぜ必要か】
 * **「JSON だけ返して」と頼んでも、そのとおりには返りません。**
 * 実際に返ってくるもの:
 *
 * ```
 * はい、以下が結果です。
 *
 * ```json
 * { "amount": 1000 }
 * ```
 *
 * ご確認ください。
 * ```
 *
 * **`JSON.parse` にそのまま渡すと落ちます。**
 * 説明文と ```json の囲みを外してから解析します。
 *
 * 【それでも失敗します】
 * **末尾が切れる**（トークン上限で途中まで）、**引用符が全角**、
 * **カンマが足りない**——これらは直しようがありません。
 * **失敗したら再質問**してください（{@link retryUntilValid} が使えます）。
 *
 * @param text AI の出力
 * @returns 取り出せた値。**取り出せなければ `undefined`**
 */
export function extractJson<T = unknown>(text: string): T | undefined {
  // **``` で囲まれていれば、その中だけを見る。**
  // 囲みの外に説明文があるのが普通です。
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced?.[1] ?? text;

  // **最初の `{` か `[` から、対応する閉じまで**を切り出す。
  // 前後の説明文を落とすためです。
  const start = body.search(/[{[]/);
  if (start < 0) return undefined;
  const opening = body[start];
  const closing = opening === "{" ? "}" : "]";
  const end = body.lastIndexOf(closing);
  if (end <= start) return undefined;

  try {
    return JSON.parse(body.slice(start, end + 1)) as T;
  } catch {
    // **直さずに諦めます。** 壊れた JSON を推測で直すと、
    // **間違った値が入ったまま通ってしまいます**——
    // 「金額が読めなかった」より「**違う金額が入った**」方が危険です。
    return undefined;
  }
}

/**
 * **正しい答えが返るまで聞き直す。**
 *
 * 【なぜ必要か】
 * AI は**同じ質問でも違う答えを返します**。
 * 1 回失敗したからといって、**その質問が悪いとは限りません**——
 * もう一度聞けば通ることがよくあります。
 *
 * 【必ず上限を決めてください】
 * **聞き直すたびに課金されます。** 既定は 2 回まで——
 * 3 回目で駄目なら、**質問の仕方が悪い**か、**AI にできないこと**です。
 *
 * 【失敗の内容を伝えると通りやすくなります】
 * `describeFailure` を渡すと、**次の質問に「何が駄目だったか」を足します**
 * ——「JSON が壊れていました。もう一度 JSON だけ返してください」と
 * 伝えた方が、ただ聞き直すより通ります。
 *
 * @param call 1 回分の呼び出し
 * @param validate 答えを確かめる（**問題があれば説明を返す**）
 * @param options `attempts`（既定 2）と `describeFailure`
 * @returns 通った答え。**全部失敗したら `undefined`**
 */
export async function retryUntilValid<T>(
  call: (hint: string | undefined) => Promise<T>,
  validate: (value: T) => string | undefined,
  options: { attempts?: number } = {},
): Promise<{ value: T; attempts: number } | undefined> {
  const attempts = Math.max(1, options.attempts ?? 2);
  let hint: string | undefined;
  for (let i = 0; i < attempts; i += 1) {
    const value = await call(hint);
    const problem = validate(value);
    if (problem === undefined) return { value, attempts: i + 1 };
    // **何が駄目だったかを次に伝えます。**
    // ただ聞き直すより通りやすくなります。
    hint = problem;
  }
  return undefined;
}
