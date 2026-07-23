/**
 * RAG(検索拡張生成)の骨格。役割は「検索」(操作は MCP)。
 * このパッケージが持つもの: (1) 文書のチャンク分割 (2) 権限を継承した検索(管理者権限での全検索をしない)
 * (3) embedding の差し込み口(未接続でも BM25 で動く) (4) 検索結果をプロンプト文脈に組む整形。
 * 検索実体は @platform/search(BM25/Meilisearch)を注入。ベクトル検索は Embedder + VectorIndex を足すだけ。
 * @packageDocumentation
 */

export * from "./rerank";
import { AppError, ErrorCode, ok, err, type Result } from "@platform/core";

/** アクセス制御タグ。ドキュメントに付与し、検索時の許可判定に使う。 */
export interface AccessControl {
  /** これらのロールのいずれかを持つ人が閲覧可(空/未指定は「全員可」ではなく `public` で明示)。 */
  roles?: string[];
  /** 明示的に許可する利用者(email 等)。 */
  users?: string[];
  /** true で認証済みの誰でも可。 */
  public?: boolean;
}

/** RAG が扱う元ドキュメント(チャンク前)。 */
export interface RagDocument {
  id: string;
  title: string;
  body: string;
  source?: string;
  /** 更新時刻(履歴・鮮度用)。 */
  updatedAt?: string;
  acl?: AccessControl;
  meta?: Record<string, unknown>;
}

/** 分割後のチャンク(検索・埋め込みの単位)。 */
export interface RagChunk {
  id: string;
  docId: string;
  title: string;
  text: string;
  index: number;
  source?: string;
  updatedAt?: string;
  acl?: AccessControl;
}

/** 検索する人。 */
export interface Principal {
  id: string;
  roles: string[];
}

/** チャンク分割オプション。 */
export interface ChunkOptions {
  /** 1チャンクの最大文字数(既定 800)。 */
  maxChars?: number;
  /** チャンク間で重ねる文字数(既定 100)。文脈の途切れを緩和。 */
  overlap?: number;
}

/**
 * 本文を段落境界を尊重してチャンク分割する。段落が長すぎる場合は maxChars で強制分割。
 * overlap 分だけ前チャンク末尾を次チャンク先頭に重ねる。
 *
 * @param doc 文書
 * @param options.maxChars 1 塊の最大文字数
 * @param options.overlap 重なり(**文脈が切れるのを防ぐ**)
 * @returns 分割した文書
 */
export function chunkDocument(doc: RagDocument, options: ChunkOptions = {}): RagChunk[] {
  const maxChars = options.maxChars ?? 800;
  const overlap = Math.min(options.overlap ?? 100, Math.floor(maxChars / 2));
  const paragraphs = doc.body.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);

  // preOverlapped=true のピースは、分割時点で既に overlap を内包しているため後段の overlap を適用しない
  const pieces: { text: string; preOverlapped: boolean }[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer.trim().length > 0) pieces.push({ text: buffer.trim(), preOverlapped: false });
    buffer = "";
  };
  for (const para of paragraphs) {
    if (para.length > maxChars) {
      flush();
      // maxChars - overlap ずつ進めて overlap 分を重ねて切る(各断片は maxChars 以内)
      for (let i = 0; i < para.length; i += Math.max(1, maxChars - overlap)) {
        pieces.push({ text: para.slice(i, i + maxChars), preOverlapped: true });
      }
      continue;
    }
    if (buffer.length + para.length + 2 > maxChars) flush();
    buffer = buffer ? `${buffer}\n\n${para}` : para;
  }
  flush();

  // 段落ベースのチャンクにだけ overlap を適用(前チャンク末尾を先頭へ)
  return pieces.map((piece, index) => {
    let text = piece.text;
    const prev = pieces[index - 1];
    if (index > 0 && overlap > 0 && !piece.preOverlapped && prev) {
      text = prev.text.slice(-overlap) + "\n" + piece.text;
    }
    return {
      id: `${doc.id}#${index}`,
      docId: doc.id,
      title: doc.title,
      text,
      index,
      ...(doc.source ? { source: doc.source } : {}),
      ...(doc.updatedAt ? { updatedAt: doc.updatedAt } : {}),
      ...(doc.acl ? { acl: doc.acl } : {}),
    };
  });
}

/**
 * 権限を満たすかを判定する(**RAG の権限継承の中核**)。
 *
 * **元の文書の権限を検索結果にも引き継ぐ**のが要点。これが無いと、
 * 「見えないはずの文書の内容が、AI の回答に出てくる」という事故になる。
 *
 * @param principal 利用者(ロール・部署など)
 * @param acl 文書のアクセス制御
 * @returns アクセスしてよいなら true
 */
export function canAccess(principal: Principal, acl?: AccessControl): boolean {
  if (!acl) return false; // ACL 未設定は既定で不可(明示 public を要求)
  if (acl.public) return true;
  if (acl.users?.includes(principal.id)) return true;
  if (acl.roles && acl.roles.some((r) => principal.roles.includes(r))) return true;
  return false;
}

/** 埋め込みベクトル生成の差し込み口(未接続なら BM25 のみで動く)。 */
export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}

/** ベクトル索引の差し込み口。 */
export interface VectorIndex {
  upsert(items: { id: string; vector: number[]; chunk: RagChunk }[]): Promise<void>;
  /** クエリベクトルに近い順に返す。 */
  query(vector: number[], limit: number): Promise<{ chunk: RagChunk; score: number }[]>;
}

/** 検索実体(@platform/search 互換の最小契約)。 */
export interface RagSearchBackend {
  index(docs: { id: string; [k: string]: unknown }[]): Promise<Result<void>>;
  search(query: string, limit?: number): Promise<Result<{ document: { id: string; [k: string]: unknown }; score?: number }[]>>;
  delete(ids: string[]): Promise<Result<void>>;
}

/** 検索1件(チャンク+スコア)。 */
export interface RagHit {
  chunk: RagChunk;
  score: number;
}

/** RAG ストア。 */
export interface RagStore {
  /** ドキュメントを分割・索引する。 */
  ingest(docs: RagDocument[]): Promise<Result<{ chunks: number }>>;
  /**
   * principal の権限で検索する。ACL を満たさないチャンクは結果から除外(管理者でも全件は返さない)。
   * limit は「取得したい件数」。内部では権限フィルタ前に多めに取得する。
   */
  retrieve(query: string, principal: Principal, limit?: number): Promise<Result<RagHit[]>>;
  /** ドキュメント(に属する全チャンク)を索引から消す。 */
  remove(docIds: string[]): Promise<Result<void>>;
}

/** RAG ストアの設定。 */
export interface RagStoreOptions {
  backend: RagSearchBackend;
  chunk?: ChunkOptions;
  /** embedding を使う場合に指定(未指定なら BM25 のみ)。 */
  embedder?: Embedder;
  vectorIndex?: VectorIndex;
  /** 権限フィルタで結果が減ることを見越した内部取得倍率(既定 4)。 */
  overFetch?: number;
}

/**
 * RAG ストアを作る。
 *
 * @param options.index ベクトル索引
 * @param options.embed 埋め込みを作る関数
 * @returns ストア(`add` で追加、`search` で検索)
 */
export function createRagStore(options: RagStoreOptions): RagStore {
  const overFetch = options.overFetch ?? 4;
  // チャンク本体を id で保持(backend は検索用の平坦文書のみ持つ想定のため、原本はここで保持)
  const chunks = new Map<string, RagChunk>();

  return {
    async ingest(docs) {
      const allChunks = docs.flatMap((d) => chunkDocument(d, options.chunk));
      for (const c of allChunks) chunks.set(c.id, c);
      const flat = allChunks.map((c) => ({ id: c.id, title: c.title, body: c.text }));
      const r = await options.backend.index(flat);
      if (!r.ok) return r;
      if (options.embedder && options.vectorIndex && allChunks.length > 0) {
        const vectors = await options.embedder.embed(allChunks.map((c) => c.text));
        await options.vectorIndex.upsert(allChunks.map((c, i) => ({ id: c.id, vector: vectors[i] ?? [], chunk: c })));
      }
      return ok({ chunks: allChunks.length });
    },

    async retrieve(query, principal, limit = 5) {
      if (query.trim() === "") return err(new AppError(ErrorCode.VALIDATION, "検索クエリが空です"));
      const fetchN = limit * overFetch;

      // ベクトル検索が使えるなら併用(なければ BM25 のみ)
      let vectorHits: RagHit[] = [];
      if (options.embedder && options.vectorIndex) {
        const [qv] = await options.embedder.embed([query]);
        if (qv) vectorHits = (await options.vectorIndex.query(qv, fetchN)).map((h) => ({ chunk: h.chunk, score: h.score }));
      }

      const textR = await options.backend.search(query, fetchN);
      if (!textR.ok) return textR;
      const textHits: RagHit[] = textR.value.flatMap((h) => {
        const chunk = chunks.get(h.document.id);
        return chunk ? [{ chunk, score: h.score ?? 0 }] : [];
      });

      // マージ(id 単位で高い方のスコア)→ 権限フィルタ → limit
      const merged = new Map<string, RagHit>();
      for (const h of [...vectorHits, ...textHits]) {
        const cur = merged.get(h.chunk.id);
        if (!cur || h.score > cur.score) merged.set(h.chunk.id, h);
      }
      const allowed = [...merged.values()]
        .filter((h) => canAccess(principal, h.chunk.acl))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      return ok(allowed);
    },

    async remove(docIds) {
      const ids = [...chunks.values()].filter((c) => docIds.includes(c.docId)).map((c) => c.id);
      for (const id of ids) chunks.delete(id);
      return options.backend.delete(ids);
    },
  };
}

/**
 * 検索結果を LLM への文脈テキストに整形する。
 *
 * **引用元を必ず付ける**。AI の回答に根拠を示せないと、利用者は検証できない
 * (そして AI は自信満々に間違える)。
 *
 * @param results 検索結果
 * @param options.maxChars 最大文字数(**トークン上限に収める**)
 * @returns 文脈テキスト(引用元つき)
 */
export function buildContext(hits: RagHit[], options: { maxChars?: number } = {}): string {
  const maxChars = options.maxChars ?? 4000;
  const blocks: string[] = [];
  let used = 0;
  for (let i = 0; i < hits.length; i += 1) {
    const h = hits[i];
    if (!h) continue;
    const head = `【${i + 1}】${h.chunk.title}${h.chunk.source ? `(${h.chunk.source})` : ""}`;
    const block = `${head}\n${h.chunk.text}`;
    if (used + block.length > maxChars) break;
    blocks.push(block);
    used += block.length;
  }
  return blocks.join("\n\n---\n\n");
}

// ─────────────────────── VectorIndex 実装 ───────────────────────

/**
 * コサイン類似度を計算する。
 *
 * **正規化済みでなくても動く**(内部で長さを割る)。
 *
 * @param a ベクトル
 * @param b ベクトル
 * @returns -1〜1(**1 が最も似ている**)。長さが違えば 0
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * メモリのベクトル索引を作る(開発・テスト用)。
 *
 * **総当たりで計算する**ので、件数が増えると遅い(数千件が限界)。
 * 本番では専用のベクトル DB(pgvector・Qdrant など)を使うこと。
 *
 * @param seed 初期データ
 * @returns ベクトル索引
 */
export function createMemoryVectorIndex(): VectorIndex {
  const items = new Map<string, { vector: number[]; chunk: RagChunk }>();
  return {
    async upsert(entries) {
      for (const e of entries) items.set(e.id, { vector: e.vector, chunk: e.chunk });
    },
    async query(vector, limit) {
      return [...items.values()]
        .map((it) => ({ chunk: it.chunk, score: cosineSimilarity(vector, it.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
  };
}

/** pgvector を使う VectorIndex が必要とする DB ポート(@platform/db の生 SQL を注入)。 */
export interface PgVectorDb {
  /** ベクトルを '[0.1,0.2,...]' 形式の文字列にして渡す。UPSERT を想定。 */
  execute(sql: string, params: unknown[]): Promise<void>;
  /** id, chunk(JSON文字列), distance を近い順に返す。 */
  queryRows(sql: string, params: unknown[]): Promise<{ id: string; chunk: string; distance: number }[]>;
}

/**
 * pgvector 版 VectorIndex。テーブルは呼び出し側で用意する想定:
 *   CREATE EXTENSION IF NOT EXISTS vector;
 *   CREATE TABLE rag_vectors (id text PRIMARY KEY, chunk jsonb NOT NULL, embedding vector(N));
 * distance(<=>)は小さいほど近いので score = 1 - distance に変換する。
 * DB を注入する設計なので、この関数自体は SQL 文字列の組み立てのみ(オフラインでも構築ロジックを検証可能)。
 *
 * @param db Prisma クライアント
 * @param options.table テーブル名
 * @returns ベクトル索引。**メモリ版と違い件数が増えても実用的**
 */
export function createPgVectorIndex(db: PgVectorDb, table = "rag_vectors"): VectorIndex {
  const toVectorLiteral = (v: number[]): string => `[${v.join(",")}]`;
  return {
    async upsert(entries) {
      for (const e of entries) {
        await db.execute(
          `INSERT INTO ${table} (id, chunk, embedding) VALUES ($1, $2, $3::vector)
           ON CONFLICT (id) DO UPDATE SET chunk = EXCLUDED.chunk, embedding = EXCLUDED.embedding`,
          [e.id, JSON.stringify(e.chunk), toVectorLiteral(e.vector)],
        );
      }
    },
    async query(vector, limit) {
      const rows = await db.queryRows(
        `SELECT id, chunk, (embedding <=> $1::vector) AS distance FROM ${table} ORDER BY embedding <=> $1::vector LIMIT $2`,
        [toVectorLiteral(vector), limit],
      );
      return rows.map((r) => ({ chunk: JSON.parse(r.chunk) as RagChunk, score: 1 - r.distance }));
    },
  };
}

// ─────────────────────── ソース取り込みヘルパー ───────────────────────
// PDF / Excel / テキスト等の各ソースから抽出済みのテキストを RagDocument に整える。
// 抽出そのもの(pdf/xlsx の解析)は取り込み側の責務にし、ここは「テキスト+ACL → RagDocument」に集中する
// (rag が pdf/xlsx に依存しないよう疎結合を保つ)。

/**
 * テキストを 1 つの文書にする。
 *
 * **長い文書は分割すること**(この関数は分割しない)。1 つの塊が大きすぎると、
 * 検索の精度が落ちる(関係ない部分まで文脈に入る)。
 *
 * @param input テキストとメタ情報
 * @returns 文書
 */
export function textToDocument(input: { id: string; title: string; text: string; source?: string; acl?: AccessControl; updatedAt?: string }): RagDocument {
  return {
    id: input.id,
    title: input.title,
    body: input.text,
    ...(input.source ? { source: input.source } : {}),
    ...(input.acl ? { acl: input.acl } : {}),
    ...(input.updatedAt ? { updatedAt: input.updatedAt } : {}),
  };
}

/**
 * 表形式データ(Excel/CSV の行オブジェクト)を RagDocument 群にする。
 * mode="row": 1 行 = 1 ドキュメント(明細検索向け)。mode="sheet": シート全体を1ドキュメント(概要検索向け)。
 * 各行は "列名: 値" の行テキストに整形する。
 *
 * @param rows DB の行
 * @param mapper 行 → 文書 の変換
 * @returns 文書の配列
 */
export function rowsToDocuments(
  rows: Record<string, unknown>[],
  options: { idPrefix: string; title: string; source?: string; acl?: AccessControl; mode?: "row" | "sheet"; rowTitle?: (row: Record<string, unknown>, index: number) => string },
): RagDocument[] {
  const mode = options.mode ?? "row";
  const rowText = (row: Record<string, unknown>): string =>
    Object.entries(row)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join("\n");

  if (mode === "sheet") {
    const body = rows.map((r, i) => `# 行 ${i + 1}\n${rowText(r)}`).join("\n\n");
    return [textToDocument({ id: options.idPrefix, title: options.title, text: body, ...(options.source ? { source: options.source } : {}), ...(options.acl ? { acl: options.acl } : {}) })];
  }
  return rows.map((row, i) => ({
    id: `${options.idPrefix}#${i}`,
    title: options.rowTitle ? options.rowTitle(row, i) : `${options.title}(行 ${i + 1})`,
    body: rowText(row),
    ...(options.source ? { source: options.source } : {}),
    ...(options.acl ? { acl: options.acl } : {}),
  }));
}

/**
 * 長いプレーンテキスト(PDF 抽出結果など)を、見出しや空行で区切って複数ドキュメント化する下ごしらえ。
 * 実際のチャンク分割は ingest 時の chunkDocument が行うので、ここでは「大きな節」に分けるだけ。
 * separator（既定: 連続空行）で分割し、空片は捨てる。1 片が maxSectionChars を超える場合はそのまま
 * （ingest でさらに分割される）。
 *
 * @param text 長いテキスト
 * @param options.maxChars 1 塊の最大文字数
 * @returns 分割した文書(**検索の精度は塊の大きさで決まる**。大きすぎると関係ない部分まで文脈に入る)
 */
export function splitTextToDocuments(
  text: string,
  options: { idPrefix: string; title: string; source?: string; acl?: AccessControl; separator?: RegExp },
): RagDocument[] {
  const separator = options.separator ?? /\n{3,}/;
  const sections = text.split(separator).map((t) => t.trim()).filter((t) => t.length > 0);
  if (sections.length <= 1) {
    return [textToDocument({ id: options.idPrefix, title: options.title, text: text.trim(), ...(options.source ? { source: options.source } : {}), ...(options.acl ? { acl: options.acl } : {}) })];
  }
  return sections.map((sec, i) => ({
    id: `${options.idPrefix}#${i}`,
    title: `${options.title}(${i + 1})`,
    body: sec,
    ...(options.source ? { source: options.source } : {}),
    ...(options.acl ? { acl: options.acl } : {}),
  }));
}

