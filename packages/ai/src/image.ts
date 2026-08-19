import { AppError, ErrorCode, err, ok, type Result } from "@platform/core";
import type { AiLogStore } from "./types";

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
 * @param options.providers 画像生成のプロバイダ
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
 * @param opts.apiKey API キー
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
