import type { AiMessage, AiProvider, AiTool, AiToolCall } from "./types";

// ─────────────────────── プロバイダ実装(fetch 注入・実 API 形状) ───────────────────────

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
}



/**
 * 道具の宣言を**Anthropic の形**に直す。
 *
 * **`input_schema`（アンダースコア）**です——
 * OpenAI の `parameters` とは名前が違います。
 */
function toAnthropicTools(tools: readonly AiTool[]): unknown[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

/**
 * 道具の宣言を**OpenAI の形**に直す。
 *
 * **`type: "function"` で包む**必要があります——
 * Anthropic のように平らには渡せません。
 */
function toOpenAiTools(tools: readonly AiTool[]): unknown[] {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));
}

/**
 * Anthropic の応答から**呼びたい道具**を取り出す。
 *
 * **`content` の中に文字と混ざって入っています**——
 * `type: "tool_use"` のものだけを拾います。
 */
function extractAnthropicToolCalls(
  content: readonly { type?: string; id?: string; name?: string; input?: unknown }[],
): AiToolCall[] {
  return content
    .filter((c) => c.type === "tool_use")
    .map((c) => ({
      id: c.id ?? "",
      name: c.name ?? "",
      input: (c.input ?? {}) as Record<string, unknown>,
    }));
}

/**
 * OpenAI の応答から**呼びたい道具**を取り出す。
 *
 * **引数は JSON の文字列**で返ります——**解析が要ります**。
 * **壊れた JSON が返ることがある**ので、
 * **失敗したら空の引数**にして、呼び出し側で弾けるようにします
 * ——ここで例外にすると、**答えの全部が失われます**。
 */
function extractOpenAiToolCalls(
  calls: readonly { id?: string; function?: { name?: string; arguments?: string } }[],
): AiToolCall[] {
  return calls.map((c) => {
    let input: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(c.function?.arguments ?? "{}");
      if (typeof parsed === "object" && parsed !== null) {
        input = parsed as Record<string, unknown>;
      }
    } catch {
      // **壊れた JSON でも落とさない。** 引数が空なら、
      // 呼び出し側の検証（`validateToolArguments`）が弾きます。
    }
    return { id: c.id ?? "", name: c.function?.name ?? "", input };
  });
}

/**
 * 画像付きのやり取りを**Anthropic の形**に直す。
 *
 * **画像が無ければ文字列のまま**返します——
 * 既存の呼び出しを壊さないためです。
 */
function toAnthropicMessages(
  messages: readonly AiMessage[],
): { role: string; content: unknown }[] {
  return messages.map((m) => {
    if (m.images === undefined || m.images.length === 0) {
      return { role: m.role, content: m.content };
    }
    return {
      role: m.role,
      content: [
        // **画像を先に置く。** Anthropic は**画像→文字の順**を推奨しており、
        // 逆にすると**読み取りの精度が落ちる**とされています。
        ...m.images.map((img) => ({
          type: "image",
          source: { type: "base64", media_type: img.mediaType, data: img.data },
        })),
        { type: "text", text: m.content },
      ],
    };
  });
}

/**
 * 画像付きのやり取りを**OpenAI の形**に直す。
 *
 * **画像は `data:` の接頭辞を付けた URL** として渡します
 * ——Anthropic とは形が違うので、共通化できません。
 */
function toOpenAiMessages(
  messages: readonly AiMessage[],
): { role: string; content: unknown }[] {
  return messages.map((m) => {
    if (m.images === undefined || m.images.length === 0) {
      return { role: m.role, content: m.content };
    }
    return {
      role: m.role,
      content: [
        { type: "text", text: m.content },
        ...m.images.map((img) => ({
          type: "image_url",
          // **`data:` の接頭辞が要ります。** 付けないと**弾かれます**
          image_url: { url: `data:${img.mediaType};base64,${img.data}` },
        })),
      ],
    };
  });
}

/**
 * Anthropic(Claude)のプロバイダ。
 *
 * @param opts.apiKey API キー(**環境変数から。コードに直書きしない**)
 * @param opts.fetchImpl fetch の実装(テスト注入用)
 * @returns プロバイダ
 * @throws {@link @platform/core#AppError} コード `EXTERNAL` — API がエラーを返した場合(`chat` 実行時)
 */
export function createAnthropicProvider(opts: { apiKey: string; fetchImpl?: typeof fetch; baseUrl?: string; version?: string }): AiProvider {
  const doFetch = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl ?? "https://api.anthropic.com";
  const version = opts.version ?? "2023-06-01";
  return {
    id: "anthropic",
    models: ["claude"],
    async chat(req) {
      const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
      const messages = req.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
      const res = await doFetch(`${base}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": version },
        body: JSON.stringify({ model: req.model, max_tokens: req.maxTokens, ...(req.temperature !== undefined ? { temperature: req.temperature } : {}), ...(system ? { system } : {}), messages: toAnthropicMessages(messages), ...(req.tools && req.tools.length > 0 ? { tools: toAnthropicTools(req.tools) } : {}) }),
      });
      const json = (await res.json()) as AnthropicResponse;
      if (!res.ok) throw new Error(`anthropic ${res.status}: ${json.error?.message ?? "unknown"}`);
      const text = (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
      const anthropicCalls = extractAnthropicToolCalls(json.content ?? []);
      return { text, ...(anthropicCalls.length > 0 ? { toolCalls: anthropicCalls } : {}), usage: { inputTokens: json.usage?.input_tokens ?? 0, outputTokens: json.usage?.output_tokens ?? 0 } };
    },
  };
}

interface OpenAiResponse {
  // **`tool_calls` を書いておくこと。** 実装は読んでいるのに型に無く、
  // 型検査が通らない状態だった(2026-08)。
  choices?: { message?: { content?: string; tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

/**
 * OpenAI のプロバイダ。
 *
 * **`chat/completions` を使う**(`responses` API より互換性が広く、
 * OpenAI 互換を謳う他社サービスでもそのまま動く)。
 *
 * @param opts.apiKey API キー
 * @param opts.baseUrl エンドポイント(**互換サービスを使うなら変更**)
 * @returns プロバイダ
 * @throws {@link @platform/core#AppError} コード `EXTERNAL` — API がエラーを返した場合(`chat` 実行時)
 */
export function createOpenAiProvider(opts: { apiKey: string; fetchImpl?: typeof fetch; baseUrl?: string }): AiProvider {
  const doFetch = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl ?? "https://api.openai.com";
  return {
    id: "openai",
    models: ["gpt", "o1"],
    async chat(req) {
      const res = await doFetch(`${base}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify({ model: req.model, messages: toOpenAiMessages(req.messages), ...(req.tools && req.tools.length > 0 ? { tools: toOpenAiTools(req.tools) } : {}), max_tokens: req.maxTokens, ...(req.temperature !== undefined ? { temperature: req.temperature } : {}) }),
      });
      const json = (await res.json()) as OpenAiResponse;
      if (!res.ok) throw new Error(`openai ${res.status}: ${json.error?.message ?? "unknown"}`);
      const openAiCalls = extractOpenAiToolCalls(json.choices?.[0]?.message?.tool_calls ?? []);
      return { ...(openAiCalls.length > 0 ? { toolCalls: openAiCalls } : {}), text: json.choices?.[0]?.message?.content ?? "", usage: { inputTokens: json.usage?.prompt_tokens ?? 0, outputTokens: json.usage?.completion_tokens ?? 0 } };
    },
  };
}

/** Gemini の応答（使う部分だけ）。 */
interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
}

/**
 * **Gemini（Google）**を使うプロバイダ。
 *
 * 【他の 2 つと違うところ】
 * - **鍵は URL のクエリ**に付けます（`?key=...`）——ヘッダではありません
 * - **やり取りの形が違います**：`role` は `user` / `model`（`assistant` ではない）
 * - **`system` の役割がありません**——先頭の `system` は
 *   **`systemInstruction` に移します**（そのまま `user` にすると
 *   **利用者の発言として扱われ、指示が効きません**）
 *
 * 【鍵が URL に載ることの注意】
 * **アクセスログに鍵が残ります。** 中継サーバやプロキシを通すなら、
 * **ログに URL を出さない設定**か、ヘッダで渡せる別の経路を検討してください。
 *
 * @param opts `apiKey`（必須）・`fetchImpl`（差し替え用）・`baseUrl`
 * @returns AI Gateway に登録するプロバイダ
 * @throws Gemini が失敗した場合（**応答が空でも例外にはなりません**——安全フィルタで止まった可能性があります）
 */
export function createGeminiProvider(opts: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}): AiProvider {
  const doFetch = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl ?? "https://generativelanguage.googleapis.com";
  return {
    id: "gemini",
    models: ["gemini"],
    async chat(req) {
      // **先頭の `system` は `systemInstruction` へ移す。**
      // Gemini には `system` の役割が無く、`user` にすると
      // **利用者の発言として扱われて指示が効きません**。
      const systemText = req.messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");
      const contents = req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          // **`assistant` ではなく `model`**（Gemini の呼び方）
          role: m.role === "assistant" ? "model" : "user",
          parts: [
            // **画像は `inline_data`**（Anthropic とも OpenAI とも形が違います）
            ...(m.images ?? []).map((img) => ({
              inline_data: { mime_type: img.mediaType, data: img.data },
            })),
            { text: m.content },
          ],
        }));

      const url = `${base}/v1beta/models/${encodeURIComponent(req.model)}:generateContent`
        + `?key=${encodeURIComponent(opts.apiKey)}`;
      const res = await doFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents,
          ...(systemText === "" ? {} : { systemInstruction: { parts: [{ text: systemText }] } }),
          generationConfig: { maxOutputTokens: req.maxTokens },
        }),
      });
      const json = (await res.json()) as GeminiResponse;
      if (!res.ok) throw new Error(`gemini ${res.status}: ${json.error?.message ?? ""}`);
      return {
        // **応答が空のことがあります**（安全フィルタで止まった場合）。
        // 例外にせず空文字を返すので、**呼び出し側で「空なら再質問」**を検討してください。
        text: json.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
        usage: {
          inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
        },
      };
    },
  };
}
