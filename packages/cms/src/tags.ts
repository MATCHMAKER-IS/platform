/**
 * タグの一括操作（リネーム・統合）。記事リストに対する純関数。
 * タグは記事から派生する値なので、変更＝各記事の tags を書き換える。
 * @packageDocumentation
 */

/** タグを持つ記事（最小要件）。 */
export interface Tagged {
  slug: string;
  tags: string[];
}

function dedupe(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/**
 * タグの名前を変える。
 *
 * **変更が必要な記事だけ**を返す(全件更新すると DB への負荷と更新日時の汚染が起きる)。
 *
 * @param posts 記事の配列
 * @param from 変更前のタグ
 * @param to 変更後のタグ
 * @returns 変更が必要な記事の `{ slug, tags }`(**変わらない記事は含まない**)
 */
export function renameTagInPosts<T extends Tagged>(posts: T[], from: string, to: string): { slug: string; tags: string[] }[] {
  const changed: { slug: string; tags: string[] }[] = [];
  for (const p of posts) {
    if (!p.tags.includes(from)) continue;
    changed.push({ slug: p.slug, tags: dedupe(p.tags.map((t) => (t === from ? to : t))) });
  }
  return changed;
}

/**
 * 複数のタグを 1 つに統合する。
 *
 * 表記ゆれ(「経費」「経費精算」「けいひ」)を揃えるのに使う。
 *
 * @param posts 記事の配列
 * @param sources 統合元のタグ
 * @param target 統合先のタグ
 * @returns 変更が必要な記事だけ(**重複は除かれる**)
 */
export function mergeTagsInPosts<T extends Tagged>(posts: T[], sources: string[], target: string): { slug: string; tags: string[] }[] {
  const src = new Set(sources);
  const changed: { slug: string; tags: string[] }[] = [];
  for (const p of posts) {
    if (!p.tags.some((t) => src.has(t))) continue;
    changed.push({ slug: p.slug, tags: dedupe(p.tags.map((t) => (src.has(t) ? target : t))) });
  }
  return changed;
}

/**
 * タグを削除する。
 *
 * @param posts 記事の配列
 * @param tag 削除するタグ
 * @returns 変更が必要な記事だけ
 */
export function removeTagFromPosts<T extends Tagged>(posts: T[], tag: string): { slug: string; tags: string[] }[] {
  const changed: { slug: string; tags: string[] }[] = [];
  for (const p of posts) {
    if (!p.tags.includes(tag)) continue;
    changed.push({ slug: p.slug, tags: p.tags.filter((t) => t !== tag) });
  }
  return changed;
}
