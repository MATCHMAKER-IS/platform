/** チャットの1メッセージ。 */
export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /**
   * **画像**（任意）。base64 の中身を渡します。
   *
   * 【使いどころ】
   * **領収書・名刺・現場の写真**を読ませるためのものです。
   * LINE で受け取った画像（`getContent`）をそのまま渡せます。
   *
   * 【必ず知っておくこと】
   * **① 画像はトークンを大量に使います。** 1 枚で**文章 1,000〜2,000 字分**に
   * 相当することがあり、**予算がすぐ尽きます**。**送る前に縮めて**ください
   * （`@platform/image`。長辺 1,500px 程度で読めます）。
   *
   * **② 読み間違えます。** 手書きの数字、かすれた印字、斜めの写真は
   * **平気で違う値を返します**——**金額は必ず人が確かめる**形にしてください。
   * 「AI が読んだからそのまま登録」は**事故のもと**です。
   *
   * **③ 個人情報が写り込みます。** 領収書には店名・日時・場所が、
   * 名刺には氏名・電話が入ります——**送る前に何が写っているか**を
   * 考えてください（`@platform/pii` では画像の中身は伏せられません）。
   */
  images?: readonly {
    /** `image/jpeg` / `image/png` など。 */
    mediaType: string;
    /** base64 の中身（**接頭辞 `data:...;base64,` は付けない**）。 */
    data: string;
  }[];
}

/** トークン使用量。 */
export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}


/** AI に使わせる道具の宣言。 */
export interface AiTool {
  /** 道具の名前（**AI がこの名前で呼びます**）。 */
  name: string;
  /**
   * 何をする道具か。
   *
   * **ここが分かりにくいと AI は使いません。**
   * 「経費を検索する」より「**指定した月の経費の一覧と合計を返す**」のように、
   * **何が返るか**まで書いてください。
   */
  description: string;
  /** 引数の形（JSON Schema）。 */
  inputSchema: Record<string, unknown>;
}

/** AI が「呼びたい」と言ってきた道具。 */
export interface AiToolCall {
  /** 応答を返すときに使う ID。 */
  id: string;
  /** 呼びたい道具の名前。 */
  name: string;
  /**
   * 渡された引数。
   *
   * **信用しないでください。** AI は**存在しない ID や範囲外の日付**を
   * 渡してきます——**実行する前に必ず検証**してください。
   */
  input: Record<string, unknown>;
}


/**
 * ストリーミングで届く塊。
 *
 * **`done` が来るまでが 1 回の返事**です。
 * `text` を貯めていけば、最後に全文になります。
 */
export type AiStreamChunk =
  /** 文字の一部。**貯めてつなぐと全文**になります。 */
  | { type: "text"; text: string }
  /**
   * 終わり。**必ず 1 つ来ます**（途中で失敗した場合も `error` 付きで来ます）。
   *
   * **`usage` は入らないことがあります**——提供者や切れ方によります。
   */
  | { type: "done"; usage?: { inputTokens: number; outputTokens: number }; error?: string };

/** アプリからの呼び出し。 */
export interface AiChatRequest {
  /** 省略時は defaultModel。 */
  model?: string;
  messages: AiMessage[];
  /** 生成トークン上限(limits.maxTokensPerCall でさらに丸められる)。 */
  maxTokens?: number;
  /**
   * **AI に使わせる道具**（任意）。
   *
   * 【何ができるか】
   * 「今月の経費の合計は？」に答えるには、**AI が社内の数字を引く**必要があります。
   * 道具を渡すと、AI は**「この道具をこの引数で呼びたい」**と返してきます
   * ——**実行するのは呼び出し側**です（基盤が勝手に実行することはありません）。
   *
   * 【必ず知っておくこと】
   * **① 呼ぶかどうかは AI が決めます。** 渡しても使わないことがあります。
   * 「必ず引いてから答える」を保証したいなら、**先に自分で引いて文脈に入れて**ください。
   *
   * **② 引数は信用できません。** AI は**存在しない ID や、範囲外の日付**を
   * 渡してきます——**実行する前に必ず検証**してください
   * （`@platform/mcp` の `validateToolArguments` が使えます）。
   *
   * **③ 危ないことをさせないでください。** 削除・送金・メール送信を
   * 道具にすると、**AI の勘違いで実行されます**。
   * **読み取りだけ**にするか、**人の確認を挟んで**ください。
   */
  tools?: readonly AiTool[];
  temperature?: number;
  /** 利用者(コスト集計・ログ用)。 */
  user?: string;
}

/** 成功時の応答。 */
export interface AiChatSuccess {
  text: string;
  /**
   * AI が「呼びたい」と言ってきた道具（**渡したときだけ**）。
   *
   * **空でないなら、答えはまだ出ていません。**
   * 道具を実行し、その結果を`messages` に足して**もう一度呼んで**ください。
   *
   * **実行するのは呼び出し側**です——基盤が勝手に実行することはありません。
   */
  toolCalls?: readonly AiToolCall[];
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
  /**
   * 1 回の応答をまとめて返す。
   *
   * **`toolCalls` を戻り型に含めること。** Gateway 側は `r.toolCalls` を読んで
   * `AiChatSuccess` に載せているのに、2026-08 まで戻り型が `{ text, usage }` だけで、
   * **道具呼び出しが型の上で消えていた**(実装は返しているのに、契約が知らない状態)。
   */
  chat(req: { model: string; messages: AiMessage[]; maxTokens: number; tools?: readonly AiTool[]; temperature?: number }): Promise<{ text: string; usage: AiUsage; toolCalls?: readonly AiToolCall[] }>;

  /**
   * **少しずつ返す**（任意）。
   *
   * **持たない提供者もあります。** その場合 Gateway は
   * **普通に呼んでまとめて 1 回で返します**——
   * **呼び出し側は同じ書き方のままで済みます**。
   */
  stream?(req: {
    model: string;
    messages: readonly AiMessage[];
    maxTokens: number;
  }): AsyncIterable<AiStreamChunk>;
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
  /**
   * **何に使ったか**（任意）。
   *
   * 【なぜ要るか】
   * `byUser` で「誰が使ったか」は分かりますが、
   * **「何に使ったか」が分からないと削りどころが見えません**——
   * 「山田さんが月 3 万円」だけでは、**減らせるのか必要なのか**判断できません。
   *
   * **`"経費の要約"` `"議事録の下書き"` のように業務の名前**を入れてください。
   * **「chat」「completion」のような技術の名前は役に立ちません**。
   */
  purpose?: string;
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
