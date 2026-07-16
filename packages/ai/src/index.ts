/**
 * AI Gateway。アプリから AI プロバイダ(Anthropic / OpenAI 等)を直接呼ばず、**必ずここを経由する**。
 * Gateway が担うもの: モデル→プロバイダのルーティング / トークン上限の強制 / 予算(累積トークン)管理 /
 * コスト計算 / 呼び出しログ(プロンプトはマスク可) / フォールバック。
 * fetch は注入可能なので、実 API 無しで形状まで検証できる。開発ルール「AI API 直接利用の禁止」の受け皿。
 * @packageDocumentation
 */
import { AppError, ErrorCode, ok, err, type Result } from "@platform/core";

/** チャットの1メッセージ。 */
export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** トークン使用量。 */
export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

/** アプリからの呼び出し。 */
export interface AiChatRequest {
  /** 省略時は defaultModel。 */
  model?: string;
  messages: AiMessage[];
  /** 生成トークン上限(limits.maxTokensPerCall でさらに丸められる)。 */
  maxTokens?: number;
  temperature?: number;
  /** 利用者(コスト集計・ログ用)。 */
  user?: string;
}

/** 成功時の応答。 */
export interface AiChatSuccess {
  text: string;
  model: string;
  provider: string;
  usage: AiUsage;
  latencyMs: number;
  /** pricing にモデルが登録されている場合のみ。 */
  costJpy?: number;
}

/** プロバイダ実装の最小契約。 */
export interface AiProvider {
  id: string;
  /** 扱えるモデル(完全一致 or 前方一致)。ルーティングの判断材料。 */
  models?: string[];
  chat(req: { model: string; messages: AiMessage[]; maxTokens: number; temperature?: number }): Promise<{ text: string; usage: AiUsage }>;
}

/** モデル別料金(1000 トークンあたり円)。 */
export interface AiPrice {
  inJpyPer1k: number;
  outJpyPer1k: number;
}

/** 呼び出しログ1件。 */
export interface AiCallLog {
  at: string;
  provider: string;
  model: string;
  user?: string;
  ok: boolean;
  latencyMs: number;
  usage?: AiUsage;
  costJpy?: number;
  error?: string;
  /** logPrompt 有効時のみ(redact 適用後)。 */
  prompt?: string;
}

/** ログの保存先(監査・コスト可視化用に差し替え可能)。 */
export interface AiLogStore {
  add(entry: AiCallLog): void | Promise<void>;
}

/**
 * AI ログのメモリ実装(開発・テスト用)。
 *
 * **本番では DB 実装を使うこと**(コストの追跡は経理に関わるので、消えては困る)。
 *
 * @param seed 初期データ
 * @returns ログストア
 */
export function createMemoryAiLogStore(): AiLogStore & {
  list(): AiCallLog[];
  totals(): { calls: number; inputTokens: number; outputTokens: number; costJpy: number; byUser: Record<string, { calls: number; costJpy: number }> };
} {
  const entries: AiCallLog[] = [];
  return {
    add(entry) {
      entries.push({ ...entry });
    },
    list() {
      return entries.map((e) => ({ ...e }));
    },
    totals() {
      const byUser: Record<string, { calls: number; costJpy: number }> = {};
      let calls = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let costJpy = 0;
      for (const e of entries) {
        if (!e.ok) continue;
        calls += 1;
        inputTokens += e.usage?.inputTokens ?? 0;
        outputTokens += e.usage?.outputTokens ?? 0;
        costJpy += e.costJpy ?? 0;
        if (e.user) {
          const u = (byUser[e.user] ??= { calls: 0, costJpy: 0 });
          u.calls += 1;
          u.costJpy += e.costJpy ?? 0;
        }
      }
      return { calls, inputTokens, outputTokens, costJpy, byUser };
    },
  };
}

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
 * AI Gateway を作る。
 *
 * **アプリは各社の SDK を直接使わない**(ADR 0010)。ここを通すことで:
 * - **モデルを差し替えられる**(Claude → GPT を設定だけで)
 * - **コストを追跡できる**(全呼び出しがログに残る)
 * - **上限を設けられる**(暴走を止める)
 *
 * @param options.provider プロバイダ(Anthropic / OpenAI など)
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
          const r = await provider.chat({ model, messages: req.messages, maxTokens, ...(req.temperature !== undefined ? { temperature: req.temperature } : {}) });
          const latencyMs = now() - t0;
          total += r.usage.inputTokens + r.usage.outputTokens;
          const price = options.pricing?.[model];
          const costJpy = price ? (r.usage.inputTokens / 1000) * price.inJpyPer1k + (r.usage.outputTokens / 1000) * price.outJpyPer1k : undefined;
          record({ at: new Date(now()).toISOString(), provider: provider.id, model, ...(req.user ? { user: req.user } : {}), ok: true, latencyMs, usage: r.usage, ...(costJpy !== undefined ? { costJpy } : {}), ...(prompt !== undefined ? { prompt } : {}) });
          return ok({ text: r.text, model, provider: provider.id, usage: r.usage, latencyMs, ...(costJpy !== undefined ? { costJpy } : {}) });
        } catch (e) {
          const latencyMs = now() - t0;
          lastError = e instanceof Error ? e.message : String(e);
          record({ at: new Date(now()).toISOString(), provider: provider.id, model, ...(req.user ? { user: req.user } : {}), ok: false, latencyMs, error: lastError, ...(prompt !== undefined ? { prompt } : {}) });
        }
      }
      return err(new AppError(ErrorCode.EXTERNAL, `AI 呼び出しに失敗しました: ${lastError}`, { details: { model } }));
    },
  };
}

// ─────────────────────── プロバイダ実装(fetch 注入・実 API 形状) ───────────────────────

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
}

/**
 * Anthropic(Claude)のプロバイダ。
 *
 * @param options.apiKey API キー(**環境変数から。コードに直書きしない**)
 * @param options.model モデル名
 * @param options.fetchImpl fetch の実装(テスト注入用)
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
        body: JSON.stringify({ model: req.model, max_tokens: req.maxTokens, ...(req.temperature !== undefined ? { temperature: req.temperature } : {}), ...(system ? { system } : {}), messages }),
      });
      const json = (await res.json()) as AnthropicResponse;
      if (!res.ok) throw new Error(`anthropic ${res.status}: ${json.error?.message ?? "unknown"}`);
      const text = (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
      return { text, usage: { inputTokens: json.usage?.input_tokens ?? 0, outputTokens: json.usage?.output_tokens ?? 0 } };
    },
  };
}

interface OpenAiResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

/**
 * OpenAI のプロバイダ。
 *
 * **`chat/completions` を使う**(`responses` API より互換性が広く、
 * OpenAI 互換を謳う他社サービスでもそのまま動く)。
 *
 * @param options.apiKey API キー
 * @param options.model モデル名
 * @param options.baseUrl エンドポイント(**互換サービスを使うなら変更**)
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
        body: JSON.stringify({ model: req.model, messages: req.messages, max_tokens: req.maxTokens, ...(req.temperature !== undefined ? { temperature: req.temperature } : {}) }),
      });
      const json = (await res.json()) as OpenAiResponse;
      if (!res.ok) throw new Error(`openai ${res.status}: ${json.error?.message ?? "unknown"}`);
      return { text: json.choices?.[0]?.message?.content ?? "", usage: { inputTokens: json.usage?.prompt_tokens ?? 0, outputTokens: json.usage?.completion_tokens ?? 0 } };
    },
  };
}

// ─────────────────────── Embedder(埋め込みベクトル生成) ───────────────────────

/** 埋め込みベクトルを生成するプロバイダの契約(@platform/rag の Embedder と構造互換)。 */
export interface AiEmbedder {
  /** モデル識別子(ログ・次元確認用)。 */
  id: string;
  embed(texts: string[]): Promise<number[][]>;
}

interface OpenAiEmbeddingResponse {
  data?: { embedding: number[] }[];
  error?: { message?: string };
}

/**
 * OpenAI Embeddings API のプロバイダ(text-embedding-3-small 等)。
 * fetch 注入でテスト可能。空配列は API を呼ばず空を返す。
 *
 * @param options.apiKey API キー
 * @param options.model モデル名(既定 text-embedding-3-small)
 * @returns 埋め込みを作る関数(**RAG の索引に使う**)
 * @throws {@link @platform/core#AppError} コード `EXTERNAL` — API がエラーを返した場合
 */
export function createOpenAiEmbedder(opts: { apiKey: string; model?: string; fetchImpl?: typeof fetch; baseUrl?: string }): AiEmbedder {
  const doFetch = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl ?? "https://api.openai.com";
  const model = opts.model ?? "text-embedding-3-small";
  return {
    id: model,
    async embed(texts) {
      if (texts.length === 0) return [];
      const res = await doFetch(`${base}/v1/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify({ model, input: texts }),
      });
      const json = (await res.json()) as OpenAiEmbeddingResponse;
      if (!res.ok) throw new Error(`openai embeddings ${res.status}: ${json.error?.message ?? "unknown"}`);
      return (json.data ?? []).map((d) => d.embedding);
    },
  };
}

/**
 * 決定的なハッシュベース擬似埋め込み(API 不要・開発/テスト用)。
 * 語をハッシュして固定次元のバッグ・オブ・ワーズ的ベクトルにする。意味は捉えないが、
 * 同じ語を含む文の近さは反映され、パイプラインの結線確認に使える。
 *
 * @param dimensions 次元数(既定 384)
 * @returns 埋め込みを作る関数。**意味を捉えない**(ハッシュを並べるだけ)ので、
 *   本番の検索には使えない。**API キー無しで動く**ので、開発・テスト用
 */
export function createHashEmbedder(dim = 64): AiEmbedder {
  const hash = (token: string): number => {
    let h = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  };
  return {
    id: `hash-${dim}`,
    async embed(texts) {
      return texts.map((text) => {
        const vec = new Array<number>(dim).fill(0);
        const tokens = text.toLowerCase().split(/\s+|(?=[、。()「」\n])/).filter(Boolean);
        for (const tok of tokens) {
          const i = hash(tok) % dim;
          vec[i] = (vec[i] ?? 0) + 1;
        }
        const norm = Math.sqrt(vec.reduce((a, v) => a + v * v, 0)) || 1;
        return vec.map((v) => v / norm);
      });
    },
  };
}

// ─────────────────────── 画像生成/編集プロバイダ ───────────────────────
// 壁打ちの「将来的な画像生成AI対応」+ 社内 nano-banana(Gemini 画像編集)の一般化。
// テキスト同様、アプリは直叩きせず Gateway 経由にできるよう、プロバイダ契約とルーティングを用意する。
// ログ/コストは既存の AiLogStore を流用(画像は1枚=1コールとして計上)。

/** 画像生成/編集のリクエスト。 */
export interface AiImageRequest {
  /** 生成/編集の指示。 */
  prompt: string;
  /** 編集モードで使う入力画像(base64・data URL 可)。省略時は生成モード。 */
  image?: string;
  model?: string;
  /** 生成枚数(既定 1)。 */
  n?: number;
  /** 出力サイズ(例 "1024x1024")。プロバイダが対応する場合のみ。 */
  size?: string;
  user?: string;
}

/** 画像生成の成功応答。 */
export interface AiImageSuccess {
  /** base64 または URL の配列。 */
  images: string[];
  model: string;
  provider: string;
  latencyMs: number;
  costJpy?: number;
}

/** 画像プロバイダの契約。 */
export interface AiImageProvider {
  id: string;
  models?: string[];
  generate(req: { prompt: string; image?: string; model: string; n: number; size?: string }): Promise<{ images: string[] }>;
}

/** 画像ゲートウェイの設定。 */
export interface AiImageGatewayOptions {
  providers: AiImageProvider[];
  defaultModel: string;
  routes?: Record<string, string>;
  /** モデル別の1枚あたり単価(円)。 */
  pricePerImageJpy?: Record<string, number>;
  /** 1回のリクエストで許可する最大枚数(既定 4)。 */
  maxImagesPerCall?: number;
  logStore?: AiLogStore;
  now?: () => number;
}

/** 画像生成ゲートウェイ。 */
export interface AiImageGateway {
  generate(req: AiImageRequest): Promise<Result<AiImageSuccess>>;
}

/**
 * 画像生成の Gateway を作る。
 *
 * **テキストの {@link createAiGateway} と同じ設計**(差し替え可能・ログ・上限)。
 * 画像生成は 1 枚あたりの単価が高いので、**コストの追跡がより重要**。
 *
 * @param options.provider 画像生成のプロバイダ
 * @param options.logStore ログの保存先
 * @returns Gateway。`generate` で呼ぶ
 */
export function createAiImageGateway(options: AiImageGatewayOptions): AiImageGateway {
  const now = options.now ?? (() => Date.now());
  const maxImages = options.maxImagesPerCall ?? 4;
  const byId = new Map(options.providers.map((p) => [p.id, p]));

  const resolve = (model: string): AiImageProvider | undefined => {
    const routed = options.routes?.[model];
    if (routed) return byId.get(routed);
    for (const p of options.providers) if (p.models?.some((m) => model === m || model.startsWith(m))) return p;
    return options.providers[0];
  };

  return {
    async generate(req) {
      if (req.prompt.trim() === "") return err(new AppError(ErrorCode.VALIDATION, "prompt が空です"));
      const model = req.model ?? options.defaultModel;
      const provider = resolve(model);
      if (!provider) return err(new AppError(ErrorCode.CONFIG, `モデル ${model} を扱う画像プロバイダがありません`));
      const n = Math.min(Math.max(req.n ?? 1, 1), maxImages);
      const t0 = now();
      try {
        const r = await provider.generate({ prompt: req.prompt, ...(req.image ? { image: req.image } : {}), model, n, ...(req.size ? { size: req.size } : {}) });
        const latencyMs = now() - t0;
        const unit = options.pricePerImageJpy?.[model];
        const costJpy = unit !== undefined ? unit * r.images.length : undefined;
        if (options.logStore) {
          try { void Promise.resolve(options.logStore.add({ at: new Date(now()).toISOString(), provider: provider.id, model, ...(req.user ? { user: req.user } : {}), ok: true, latencyMs, ...(costJpy !== undefined ? { costJpy } : {}) })).catch(() => {}); } catch { /* ログ失敗は無視 */ }
        }
        return ok({ images: r.images, model, provider: provider.id, latencyMs, ...(costJpy !== undefined ? { costJpy } : {}) });
      } catch (e) {
        const latencyMs = now() - t0;
        const message = e instanceof Error ? e.message : String(e);
        if (options.logStore) {
          try { void Promise.resolve(options.logStore.add({ at: new Date(now()).toISOString(), provider: provider.id, model, ...(req.user ? { user: req.user } : {}), ok: false, latencyMs, error: message })).catch(() => {}); } catch { /* 無視 */ }
        }
        return err(new AppError(ErrorCode.EXTERNAL, `画像生成に失敗しました: ${message}`, { details: { model } }));
      }
    },
  };
}

interface OpenAiImageResponse {
  data?: { b64_json?: string; url?: string }[];
  error?: { message?: string };
}

/**
 * OpenAI Images API(gpt-image-1 / dall-e-3 等)のプロバイダ。fetch 注入でテスト可能。
 *
 *
 * @param options.apiKey API キー
 * @param options.model モデル名(既定 dall-e-3)
 * @returns 画像生成のプロバイダ
 * @throws {@link @platform/core#AppError} コード `EXTERNAL` — API がエラーを返した場合
 */
export function createOpenAiImageProvider(opts: { apiKey: string; fetchImpl?: typeof fetch; baseUrl?: string }): AiImageProvider {
  const doFetch = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl ?? "https://api.openai.com";
  return {
    id: "openai-image",
    models: ["gpt-image", "dall-e"],
    async generate(req) {
      const res = await doFetch(`${base}/v1/images/generations`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify({ model: req.model, prompt: req.prompt, n: req.n, ...(req.size ? { size: req.size } : {}) }),
      });
      const json = (await res.json()) as OpenAiImageResponse;
      if (!res.ok) throw new Error(`openai images ${res.status}: ${json.error?.message ?? "unknown"}`);
      return { images: (json.data ?? []).map((d) => d.b64_json ?? d.url ?? "").filter(Boolean) };
    },
  };
}

