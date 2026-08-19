/**
 * AI Gateway の配線(アプリはここ経由でのみ AI を使う。ADR-0010)。
 * ANTHROPIC_API_KEY があれば実プロバイダ、無ければ**モックプロバイダ**で動く(開発・デモ用)。
 * ログ/コストは logStore に貯まり、/api/ai/usage と管理画面で可視化する。
 * @packageDocumentation
 */
import { createAiGateway, createAnthropicProvider, createMemoryAiLogStore, createAiImageGateway, createOpenAiImageProvider, type AiProvider, type AiImageProvider, type AiGateway, type AiImageGateway } from "@platform/ai";
import {
  createSpendingLimiter, createConcurrencyLimiter,
  detectPromptInjection, detectSensitiveOutput, wrapAsData,
  createDecisionLog, createToolCallLog,
} from "@platform/ai";
import { featureEnv } from "./env";

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

// ─────────────────────── 守り(基盤にあったが繋いでいなかった) ───────────────────────

/**
 * 人・部署ごとの費用上限（月・円）。
 *
 * **全体の上限だけだと、1 人の暴走で全員が止まる。**
 * 誤って繰り返し処理を仕掛けた人がいたとき、**その人だけ**止める必要がある。
 *
 * **`usageRatio` が 0.8 を超えたら知らせること。** 上限に当たってから
 * 「今月はもう使えません」と言われても、業務の予定は変えられない。
 */
export const aiSpending = createSpendingLimiter({}, { defaultLimitJpy: 3_000 });

/**
 * 同時実行の制限。
 *
 * **100 人が同時に使うと提供者のレート制限に当たる。**
 * 当たると全員がエラーになり「AI が壊れた」と見える。
 * 順番に流せば待たされはするが**全員通る**——待つ方がましである。
 */
export const aiConcurrency = createConcurrencyLimiter(5);

/**
 * AI の判断の記録（後から説明するため）。
 *
 * 「なぜこの経費が却下されたか」を説明できないと、**労務・会計では使えない**。
 * 「AI が判断しました」は説明にならない。
 *
 * **メモリ実装なので再起動で消える。** 説明を求められるのは数か月後なので、
 * **本番では DB に入れること**。
 */
export const aiDecisions = createDecisionLog();

/** AI が呼んだ道具の記録（`@platform/audit` は人の操作、こちらは AI の実行）。 */
export const aiToolCalls = createToolCallLog();

/**
 * 送る前の点検。
 *
 * **指示の乗っ取り（プロンプトインジェクション）は完全には防げない。**
 * 言い回しは無限にあり、日本語・英語・記号の混在でいくらでも書ける。
 * ここでできるのは「よくある形」を見つけることだけで、
 * **本当の守りは「AI に権限を渡さない」**である。
 *
 * @param text 利用者の入力、または取り込んだ文書
 * @returns 疑わしい理由（空なら「見つからなかった」だけ。安全の保証ではない）
 */
export function inspectAiInput(text: string): string[] {
  return detectPromptInjection(text);
}

/**
 * 返す前の点検。
 *
 * **入力を伏せても、AI は文脈から推測して書く。**
 * RAG で取り込んだ文書から漏れる方が現実的で、
 * 就業規則を引いたつもりが**同じ索引の給与表を引用**することがある。
 *
 * @param text AI の出力
 * @returns 見つかった機微情報の種類（空なら「見つからなかった」だけ）
 */
export function inspectAiOutput(text: string): string[] {
  return detectSensitiveOutput(text);
}

/**
 * 取り込んだ文書を「データ」として囲む。
 *
 * 文書をそのまま貼ると **AI は指示と区別できない**——
 * 文書中の「〜せよ」を命令として読む。囲めば完全ではないがかなり効く。
 */
export { wrapAsData };

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
