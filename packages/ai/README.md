# @platform/ai

**AI Gateway**。アプリから AI プロバイダ(Anthropic / OpenAI 等)を直接呼ばず、必ずここを経由します(開発ルール)。Gateway が一括で担うもの:

- **ルーティング**: モデル名→プロバイダ(明示 routes > provider.models > 接頭辞 claude/gpt/o1/gemini)
- **制御**: 1回あたり生成トークン上限の強制、累積トークン予算(超過は `RATE_LIMITED`)
- **コスト管理**: モデル別料金表(円/1kトークン)から `costJpy` を算出、利用者別に集計
- **ログ**: 呼び出しログ(成功/失敗・レイテンシ・usage・コスト)。プロンプトは既定で保存せず、残す場合も `redact` でマスク
- **フォールバック**: プロバイダ障害時に次候補へ(オプション)

```ts
import { createAiGateway, createAnthropicProvider, createMemoryAiLogStore } from "@platform/ai";

const logStore = createMemoryAiLogStore();
export const ai = createAiGateway({
  providers: [createAnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY })],
  defaultModel: "claude-sonnet-4-6",
  pricing: { "claude-sonnet-4-6": { inJpyPer1k: 0.45, outJpyPer1k: 2.25 } },
  limits: { maxTokensPerCall: 1024, maxTotalTokens: 5_000_000 },
  redact: maskPii,           // @platform/pii と組み合わせ推奨
  logStore,
});

const r = await ai.chat({ messages: [{ role: "user", content: "要約して: ..." }], user: session.email });
if (r.ok) console.log(r.value.text, r.value.costJpy);
```

すべて `Result` 返し(@platform/core)。`fetchImpl` 注入で実 API 無しにテスト可能(プロバイダのリクエスト形状もスモークで検証済み)。**実 API への疎通は API キー設定後に各環境で確認**してください。プロバイダ追加は `AiProvider`(id / models / chat)を実装して配列に足すだけです。

## 埋め込み(Embedder)

`@platform/rag` のベクトル検索に渡す埋め込みプロバイダも提供します。`createOpenAiEmbedder`(text-embedding-3-small 等・fetch 注入可)と、API 不要でパイプライン確認に使える `createHashEmbedder`(決定的な擬似埋め込み)。

```ts
import { createOpenAiEmbedder } from "@platform/ai";
const embedder = createOpenAiEmbedder({ apiKey: env.OPENAI_API_KEY });
```

## 画像生成/編集(AI Image Gateway)

テキストと同様、アプリは画像 API を直叩きせず Gateway 経由にできます(壁打ちの「将来的な画像生成AI対応」+ 社内 nano-banana の一般化)。

- `createAiImageGateway({ providers, defaultModel, pricePerImageJpy })`: ルーティング・枚数上限・1枚単価コスト・ログ(AiLogStore 流用)
- `createOpenAiImageProvider({ apiKey })`: OpenAI Images API(gpt-image-1 / dall-e-3)
- 生成/編集は同じ `generate({ prompt, image? })`。`image` を渡すと編集モード

```ts
const imageGw = createAiImageGateway({
  providers: [createOpenAiImageProvider({ apiKey })],
  defaultModel: "gpt-image-1",
  pricePerImageJpy: { "gpt-image-1": 6 },
  logStore,
});
const r = await imageGw.generate({ prompt: "背景を青空に", image: dataUrl, user });
```

Gemini 等の別プロバイダは `AiImageProvider`(id / models / generate)を実装して providers に足すだけです。
