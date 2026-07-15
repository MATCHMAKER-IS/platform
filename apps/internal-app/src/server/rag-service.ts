/**
 * RAG サービスの配線(internal-app)。@platform/rag + @platform/search(BM25)+ hash embedder。
 * 権限継承検索のデモ・社内文書検索の土台。実運用では pgvector + OpenAI embedder に差し替える。
 * @packageDocumentation
 */
import { createRagStore, createMemoryVectorIndex, textToDocument, type RagDocument } from "@platform/rag";
import { replaceByDictionary, buildGlossaryHint, type ReplacementRule } from "@platform/utils";
import { createSearch, createMemorySearch } from "@platform/search";
import { createHashEmbedder } from "@platform/ai";
import { createDictionaryStore, type DictionaryDb, type DictionaryChange } from "./dictionary-store.js";
import { toCsv, parseCsv } from "@platform/csv";

/** アプリ共通の RAG ストア(メモリ実装・プロセス内)。 */
export const ragStore = createRagStore({
  backend: createSearch(createMemorySearch()),
  embedder: createHashEmbedder(96),
  vectorIndex: createMemoryVectorIndex(),
  chunk: { maxChars: 600, overlap: 80 },
});

/** 初期サンプル文書(権限継承の挙動が分かるよう ACL 違いを用意)。 */
const SEED: RagDocument[] = [
  { id: "pub-notice", title: "年末年始の休業", body: "12月29日から1月3日まで休業します。緊急連絡は当番窓口へ。", source: "お知らせ", acl: { public: true } },
  { id: "hr-bonus", title: "賞与計算規程", body: "賞与は基本給と評価係数から算出します。評価は S/A/B/C の4段階で、係数はそれぞれ 2.0/1.5/1.0/0.5 です。支給は6月と12月。", source: "人事規程", acl: { roles: ["hr", "admin"] } },
  { id: "exec-plan", title: "来期経営計画(役員限定)", body: "来期は新規事業に重点投資し、原資は既存事業の利益率改善で確保します。", source: "経営", acl: { roles: ["admin"] } },
];

let seeded = false;
/** 初期文書を一度だけ投入する(冪等)。 */
export async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  seeded = true;
  await ragStore.ingest(SEED);
}

// ─────────────────────── 文字起こし → 辞書補正 → RAG 投入 ───────────────────────
// 音声認識の定型的な誤変換を辞書で補正してから RAG に取り込む導線。
// 辞書の中身は社内用語に合わせて調整する(ここではサンプル)。

// 辞書はアプリ内で編集できるよう可変ストアにする。DB(Prisma)があれば永続化する。
// 検証・オフラインでは db=null でメモリのみで動作(下の services 側で db を注入)。
// 非エンジニアが管理画面から追加・削除でき、再起動後も残ることを想定。
const SEED_REPLACEMENTS: ReplacementRule[] = [
  { from: "議事六", to: "議事録" },
  { from: "御社の方針", to: "弊社の方針" },
  { from: "アイティー部門", to: "IT部門" },
  { from: "ケーピーアイ", to: "KPI" },
];
const SEED_TERMS: string[] = ["情シス", "内製化", "基盤", "monorepo", "KPI"];

let dictionaryDb: DictionaryDb | null = null;

/** 辞書変更の履歴(監査・メモリ保持。本番は @platform/audit の永続ログへ)。 */
export interface DictionaryAuditEntry extends DictionaryChange {
  at: string;
  actor: string;
}
const dictionaryAudit: DictionaryAuditEntry[] = [];
let currentActor = "system";

/** 監査の実行者を設定する(API 側でログインユーザーを渡す)。 */
export function setDictionaryActor(actor: string): void {
  currentActor = actor;
}

function recordChange(change: DictionaryChange): void {
  dictionaryAudit.push({ ...change, at: new Date().toISOString(), actor: currentActor });
  if (dictionaryAudit.length > 500) dictionaryAudit.shift();
}

/** 辞書の変更履歴を取得(新しい順)。 */
export function getDictionaryAudit(limit = 100): DictionaryAuditEntry[] {
  return dictionaryAudit.slice(-limit).reverse();
}

function makeDictionary(db: DictionaryDb | null) {
  return createDictionaryStore({ db, seedReplacements: SEED_REPLACEMENTS, seedTerms: SEED_TERMS, onChange: recordChange });
}

/** DB を注入して辞書を永続化する(services 側から呼ぶ)。null ならメモリのみ。 */
export function configureDictionaryDb(db: DictionaryDb | null): void {
  dictionaryDb = db;
  dictionary = makeDictionary(db);
}

let dictionary = makeDictionary(dictionaryDb);

/** 起動時に DB から辞書を読み込む(冪等・失敗時はメモリ初期値で継続)。 */
export async function ensureDictionaryLoaded(): Promise<{ loaded: boolean; replacements: number; terms: number }> {
  return dictionary.loadFromDb();
}

/** 辞書が DB 永続化されているか(UI 表示用)。 */
export function isDictionaryPersistent(): boolean {
  return dictionary.isPersistent();
}

/** 現在の補正辞書(読み取り専用コピー)。 */
export function getReplacements(): ReplacementRule[] {
  return dictionary.getReplacements();
}

/** 補正ルールを追加(from 重複は上書き)。空 from は無視。 */
export function addReplacement(rule: ReplacementRule): boolean {
  return dictionary.addReplacement(rule);
}

/** 補正ルールを削除。削除できたら true。 */
export function removeReplacement(from: string): boolean {
  return dictionary.removeReplacement(from);
}

/** 現在の固有名詞リスト(読み取り専用コピー)。 */
export function getGlossaryTerms(): string[] {
  return dictionary.getTerms();
}

/** 固有名詞を追加(重複は無視)。 */
export function addGlossaryTerm(term: string): boolean {
  return dictionary.addTerm(term);
}

/** 固有名詞を削除。削除できたら true。 */
export function removeGlossaryTerm(term: string): boolean {
  return dictionary.removeTerm(term);
}

/** 辞書補正後のテキストと、適用によって変化したかを返す(現在の辞書ストアを使用)。 */
export function normalizeTranscript(text: string): { corrected: string; changed: boolean } {
  const corrected = replaceByDictionary(text, dictionary.getReplacements());
  return { corrected, changed: corrected !== text };
}

/** LLM に渡す用語ヒント(生成・要約時の文脈補正用・現在の固有名詞リストを使用)。 */
export function transcriptGlossaryHint(): string {
  return buildGlossaryHint(dictionary.getTerms());
}

// ─────────────────────── 辞書の CSV 入出力(バックアップ・一括登録) ───────────────────────

/** 補正ルールを CSV 文字列にする(from,to のヘッダ付き)。Excel で開ける BOM 付き。 */
export function exportReplacementsCsv(): string {
  return toCsv(dictionary.getReplacements() as unknown as Record<string, unknown>[], { columns: [{ key: "from" }, { key: "to" }], bom: true });
}

/** 固有名詞を CSV 文字列にする(term のヘッダ付き)。 */
export function exportTermsCsv(): string {
  return toCsv(dictionary.getTerms().map((term) => ({ term })), { columns: [{ key: "term" }], bom: true });
}

/**
 * CSV から補正ルールを一括取り込みする(from,to 列)。既存 from は上書き。
 * 空行・from 空は無視。取り込んだ件数と無視した件数を返す。
 */
export function importReplacementsCsv(csv: string): { added: number; skipped: number } {
  const rows = parseCsv(csv, { header: true }) as Record<string, string>[];
  let added = 0, skipped = 0;
  for (const row of rows) {
    const from = (row.from ?? "").trim();
    const to = row.to ?? "";
    if (!from) { skipped += 1; continue; }
    if (dictionary.addReplacement({ from, to })) added += 1;
    else skipped += 1;
  }
  return { added, skipped };
}

/** CSV から固有名詞を一括取り込みする(term 列)。重複・空は無視。 */
export function importTermsCsv(csv: string): { added: number; skipped: number } {
  const rows = parseCsv(csv, { header: true }) as Record<string, string>[];
  let added = 0, skipped = 0;
  for (const row of rows) {
    const term = (row.term ?? "").trim();
    if (!term) { skipped += 1; continue; }
    if (dictionary.addTerm(term)) added += 1;
    else skipped += 1;
  }
  return { added, skipped };
}

/**
 * 文字起こしテキストを辞書補正してから RAG に取り込む。
 * 補正前後のテキストを返すので、UI で差分を見せられる。
 */
export async function ingestTranscript(input: { id: string; title: string; text: string; acl?: RagDocument["acl"] }): Promise<{ id: string; chunks: number; corrected: string; changed: boolean }> {
  const { corrected, changed } = normalizeTranscript(input.text);
  const doc = textToDocument({ id: input.id, title: input.title, text: corrected, source: "文字起こし", ...(input.acl ? { acl: input.acl } : {}) });
  const r = await ragStore.ingest([doc]);
  return { id: input.id, chunks: r.ok ? r.value.chunks : 0, corrected, changed };
}
