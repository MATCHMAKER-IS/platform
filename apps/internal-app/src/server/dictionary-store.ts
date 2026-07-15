/**
 * 辞書(補正ルール・固有名詞)の永続化ストア。
 *
 * メモリキャッシュを一次ソースにしつつ、DB(Prisma)があれば読み書きを同期する。
 * - 起動時に {@link loadFromDb} で DB から読み込む(失敗してもメモリ初期値で動作継続)。
 * - 追加・削除は同期的にメモリを更新し、DB へは背後で書き込む(fire-and-forget)。
 * これにより既存の同期 API(getReplacements 等)を壊さず、再起動後も辞書が残る。
 * @packageDocumentation
 */
import type { ReplacementRule } from "@platform/utils";

/** Prisma の GlossaryReplacement デリゲート(必要な操作だけを型で要求)。 */
export interface ReplacementDelegate {
  findMany(args?: unknown): Promise<{ from: string; to: string }[]>;
  upsert(args: { where: { from: string }; update: { to: string }; create: { from: string; to: string } }): Promise<unknown>;
  delete(args: { where: { from: string } }): Promise<unknown>;
}

/** Prisma の GlossaryTerm デリゲート。 */
export interface TermDelegate {
  findMany(args?: unknown): Promise<{ term: string }[]>;
  upsert(args: { where: { term: string }; update: Record<string, never>; create: { term: string } }): Promise<unknown>;
  delete(args: { where: { term: string } }): Promise<unknown>;
}

export interface DictionaryDb {
  glossaryReplacement: ReplacementDelegate;
  glossaryTerm: TermDelegate;
}

export interface DictionaryStoreOptions {
  /** DB デリゲート。null なら DB を使わずメモリのみ(検証・オフライン向け)。 */
  db?: DictionaryDb | null;
  /** 初期の補正ルール(DB が空/未接続のときのフォールバック)。 */
  seedReplacements?: ReplacementRule[];
  /** 初期の固有名詞。 */
  seedTerms?: string[];
  /** DB 書き込み失敗時のハンドラ(既定は握りつぶし)。 */
  onError?: (err: unknown) => void;
  /** 変更監査フック。追加・削除のたびに呼ばれる(誰が・何を変えたかの記録に使う)。 */
  onChange?: (change: DictionaryChange) => void;
}

/** 辞書への変更(監査用)。 */
export interface DictionaryChange {
  /** 対象種別。 */
  kind: "replacement" | "term";
  /** 操作。 */
  action: "add" | "update" | "remove";
  /** 対象のキー(replacement は from、term は語)。 */
  key: string;
  /** 変更後の値(replacement の to。remove 時は undefined)。 */
  value?: string;
}

export interface DictionaryStore {
  getReplacements(): ReplacementRule[];
  addReplacement(rule: ReplacementRule): boolean;
  removeReplacement(from: string): boolean;
  getTerms(): string[];
  addTerm(term: string): boolean;
  removeTerm(term: string): boolean;
  /** DB から辞書を読み込みメモリを置き換える(冪等・失敗時は現状維持)。 */
  loadFromDb(): Promise<{ loaded: boolean; replacements: number; terms: number }>;
  /** DB を使っているか(UI で「永続化: 有効/無効」を出すため)。 */
  isPersistent(): boolean;
}

export function createDictionaryStore(options: DictionaryStoreOptions = {}): DictionaryStore {
  const db = options.db ?? null;
  const onError = options.onError ?? (() => {});
  const onChange = options.onChange ?? (() => {});
  const replacements: ReplacementRule[] = (options.seedReplacements ?? []).map((r) => ({ ...r }));
  const terms: string[] = [...(options.seedTerms ?? [])];
  let loaded = false;

  // DB 書き込みは fire-and-forget(呼び出し側の同期 API を止めない)。
  const bg = (p: Promise<unknown> | undefined): void => {
    if (p) void p.catch(onError);
  };

  return {
    getReplacements() {
      return replacements.map((r) => ({ ...r }));
    },
    addReplacement(rule) {
      const from = rule.from.trim();
      if (!from) return false;
      const to = rule.to;
      const idx = replacements.findIndex((r) => r.from === from);
      const isUpdate = idx >= 0;
      if (isUpdate) replacements[idx] = { from, to };
      else replacements.push({ from, to });
      if (db) bg(db.glossaryReplacement.upsert({ where: { from }, update: { to }, create: { from, to } }));
      onChange({ kind: "replacement", action: isUpdate ? "update" : "add", key: from, value: to });
      return true;
    },
    removeReplacement(from) {
      const idx = replacements.findIndex((r) => r.from === from);
      if (idx < 0) return false;
      replacements.splice(idx, 1);
      if (db) bg(db.glossaryReplacement.delete({ where: { from } }));
      onChange({ kind: "replacement", action: "remove", key: from });
      return true;
    },
    getTerms() {
      return [...terms];
    },
    addTerm(term) {
      const t = term.trim();
      if (!t || terms.includes(t)) return false;
      terms.push(t);
      if (db) bg(db.glossaryTerm.upsert({ where: { term: t }, update: {}, create: { term: t } }));
      onChange({ kind: "term", action: "add", key: t });
      return true;
    },
    removeTerm(term) {
      const t = term.trim();
      const idx = terms.indexOf(t);
      if (idx < 0) return false;
      terms.splice(idx, 1);
      if (db) bg(db.glossaryTerm.delete({ where: { term: t } }));
      onChange({ kind: "term", action: "remove", key: t });
      return true;
    },
    async loadFromDb() {
      if (!db) return { loaded: false, replacements: replacements.length, terms: terms.length };
      if (loaded) return { loaded: true, replacements: replacements.length, terms: terms.length };
      try {
        const [rows, termRows] = await Promise.all([db.glossaryReplacement.findMany(), db.glossaryTerm.findMany()]);
        // DB に1件でもあれば DB を正とする。空ならシードをそのまま DB へ書き込む(初回投入)。
        if (rows.length > 0) {
          replacements.splice(0, replacements.length, ...rows.map((r) => ({ from: r.from, to: r.to })));
        } else {
          for (const r of replacements) bg(db.glossaryReplacement.upsert({ where: { from: r.from }, update: { to: r.to }, create: { from: r.from, to: r.to } }));
        }
        if (termRows.length > 0) {
          terms.splice(0, terms.length, ...termRows.map((t) => t.term));
        } else {
          for (const t of terms) bg(db.glossaryTerm.upsert({ where: { term: t }, update: {}, create: { term: t } }));
        }
        loaded = true;
        return { loaded: true, replacements: replacements.length, terms: terms.length };
      } catch (err) {
        onError(err);
        return { loaded: false, replacements: replacements.length, terms: terms.length };
      }
    },
    isPersistent() {
      return db !== null;
    },
  };
}
