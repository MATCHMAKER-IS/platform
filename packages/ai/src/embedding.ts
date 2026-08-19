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
 * @param opts.apiKey API キー
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
 * @param dim 次元数(既定 384)
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
