# @platform/ai

AI の呼び出し（Anthropic / OpenAI / Gemini）。**費用の上限・伏せ字・記録**を通します。

## これは何のためか

**AI は「便利だが危ない」もの**です。

- **送ったものは取り消せません**（個人情報を送ってしまったら終わりです）
- **青天井で課金されます**（間違ったループで請求が跳ねます）
- **間違えます**（それらしい嘘を返します）

このパッケージは、**必ず Gateway を経由させる**ことで、
**伏せ字・上限・記録**を効かせるためのものです（ADR 0010）。

## 使う前に知っておくこと

| | |
|---|---|
| **必ず Gateway 経由で** | 直接叩くと、**伏せ字も上限も記録も効きません** |
| **プロンプトは社外へ出ます** | 個人情報は `@platform/pii` で伏せてから。**画像の中身は伏せられません** |
| **上限を必ず入れる** | **青天井だと、間違ったループで請求が跳ねます**。人ごとの上限（`createSpendingLimiter`）も使えます |
| **A/B 比較は呼び出しが 2 倍** | **費用も 2 倍**です。`sampleRate` で一部だけにしてください |
| **道具は読み取りだけに** | 削除・送金を渡すと、**AI の勘違いで実行されます**（下の「道具を使うときの注意」へ） |


## よく使うもの

```ts
import { createAiGateway, estimateTokens, extractJson } from "@platform/ai";
```

## 道具（ツール呼び出し）を使うときの注意

**「今月の経費の合計は？」に答えるには、AI が社内の数字を引く必要があります。**
`tools` を渡すと、AI は「この道具をこの引数で呼びたい」と返してきます。

**実行するのは呼び出し側です。** 基盤が勝手に実行することはありません。

```ts
const r = await gateway.chat({
  messages: [{ role: "user", content: "今月の経費は？" }],
  tools: [{
    name: "listExpenses",
    description: "指定した月の経費の一覧と合計を返す",
    inputSchema: {
      type: "object",
      required: ["month"],
      properties: { month: { type: "string" } },
    },
  }],
});

// **空でないなら、答えはまだ出ていません。**
// 実行して結果を messages に足し、もう一度呼んでください。
if (r.ok && r.value.toolCalls?.length) {
  for (const call of r.value.toolCalls) {
    // ここで検証してから実行する（下の②を参照）
  }
}
```

### ① 呼ぶかどうかは AI が決めます

**渡しても使わないことがあります。**

必ず引かせたいなら、**先に自分で引いて文脈に入れて**ください。
「道具を渡したから必ず最新の数字で答える」とは限りません。

### ② 引数は信用できません

**存在しない ID や範囲外の日付を渡してきます。**

`@platform/mcp` の `validateToolArguments` で**実行する前に検証**してください。

```ts
import { validateToolArguments } from "@platform/mcp";

const invalid = validateToolArguments(tool.inputSchema, call.input);
if (invalid !== undefined) {
  // AI に「引数が違う」と返して、やり直させる
}
```

**検証せずに実行すると、その場で落ちるか、もっと悪いことに
「それらしい間違った結果」を返します**——金額に `"1000円"` が渡って
`NaN` になり、**0 円として登録される**のが最悪の形です。

### ③ 危ないことをさせないでください

**削除・送金・メール送信を道具にすると、AI の勘違いで実行されます。**

| してよいこと | 避けること |
|---|---|
| 一覧を引く / 検索する | **削除する** |
| 集計する / 数える | **送金・支払いをする** |
| 状態を見る | **メールや通知を送る** |

**読み取りだけ**にするか、**人の確認を挟んで**ください。

```ts
// 悪い例: AI が呼んだら即座に消える
{ name: "deleteExpense", ... }

// よい例: AI は「消したい」と言うだけ。実際に消すのは人が押してから
{ name: "markForDeletion", description: "削除の候補として印を付ける（実際には消しません）" }
```

**「AI は間違えない」という前提で作らないでください。**
間違えたときに**取り返しがつくか**で、道具にしてよいかを決めてください。

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
