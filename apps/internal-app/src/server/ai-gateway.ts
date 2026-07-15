/**
 * AI Gateway の配線(アプリはここ経由でのみ AI を使う。ADR-0010)。
 * ANTHROPIC_API_KEY があれば実プロバイダ、無ければ**モックプロバイダ**で動く(開発・デモ用)。
 * ログ/コストは logStore に貯まり、/api/ai/usage と管理画面で可視化する。
 * @packageDocumentation
 */
import { createAiGateway, createAnthropicProvider, createMemoryAiLogStore, createAiImageGateway, createOpenAiImageProvider, type AiProvider, type AiImageProvider, type AiGateway, type AiImageGateway } from "@platform/ai";
import { featureEnv } from "./env.js";

const apiKey = featureEnv.ANTHROPIC_API_KEY || undefined;

/** 開発・デモ用のモック(実キー未設定時)。入力の長さから擬似的な usage を返す。 */
function createMockProvider(): AiProvider {
  return {
    id: "mock",
    models: ["claude", "mock"],
    async chat(req) {
      const joined = req.messages.map((m) => m.content).join(" ");
      const inputTokens = Math.ceil(joined.length / 3);
      const outputTokens = Math.min(req.maxTokens, 120);
      const text = `【モック要約】入力 ${req.messages.length} 通・約 ${inputTokens} トークン。ANTHROPIC_API_KEY を設定すると実際の要約になります。`;
      return { text, usage: { inputTokens, outputTokens } };
    },
  };
}

/** ログ/コスト集計ストア(プロセス内)。管理画面から参照する。 */
export const aiLogStore = createMemoryAiLogStore();

/** アプリ共通の AI Gateway。 */
export const aiGateway: AiGateway = createAiGateway({
  providers: apiKey ? [createAnthropicProvider({ apiKey })] : [createMockProvider()],
  defaultModel: apiKey ? "claude-sonnet-4-6" : "mock",
  pricing: {
    "claude-sonnet-4-6": { inJpyPer1k: 0.45, outJpyPer1k: 2.25 },
    "claude-opus-4-6": { inJpyPer1k: 2.25, outJpyPer1k: 11.25 },
  },
  limits: { maxTokensPerCall: 1024, maxTotalTokens: 5_000_000 },
  // メール・電話番号を伏せてからログへ(プロンプト自体は logPrompt:false で既定不保存)
  redact: (text) => text.replace(/[\w.+-]+@[\w.-]+\.\w+/g, "***@***").replace(/0\d{1,4}-?\d{1,4}-?\d{3,4}/g, "***-****"),
  logPrompt: false,
  logStore: aiLogStore,
});

/** モック稼働か(UI 表示用)。 */
export const aiIsMock = !apiKey;

// ─────────────────────── 画像ゲートウェイ ───────────────────────

const openaiKey = featureEnv.OPENAI_API_KEY || undefined;

/** 開発・デモ用のモック画像プロバイダ(実キー未設定時)。data URL のプレースホルダ画像を返す。 */
function createMockImageProvider(): AiImageProvider {
  return {
    id: "mock-image",
    models: ["mock", "gpt-image", "gemini"],
    async generate(req) {
      // 1x1 透明 PNG の data URL(プロンプトをコメント代わりに識別子へ)
      const placeholder = "data:image/svg+xml;base64," + Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e0e7ff"/><text x="128" y="120" font-size="14" text-anchor="middle" fill="#4338ca">MOCK IMAGE</text><text x="128" y="145" font-size="10" text-anchor="middle" fill="#6366f1">${req.prompt.slice(0, 24)}</text></svg>`
      ).toString("base64");
      return { images: Array(req.n).fill(placeholder) };
    },
  };
}

/** 画像ゲートウェイ。OPENAI_API_KEY があれば OpenAI Images、無ければモック。 */
export const aiImageGateway: AiImageGateway = createAiImageGateway({
  providers: openaiKey ? [createOpenAiImageProvider({ apiKey: openaiKey })] : [createMockImageProvider()],
  defaultModel: openaiKey ? "gpt-image-1" : "mock",
  pricePerImageJpy: { "gpt-image-1": 6, "dall-e-3": 12 },
  maxImagesPerCall: 2,
  logStore: aiLogStore,
});

/** 画像がモック稼働か(UI 表示用)。 */
export const aiImageIsMock = !openaiKey;
