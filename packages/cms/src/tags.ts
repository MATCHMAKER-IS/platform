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

/** タグ `from` を `to` にリネームした記事だけを返す（{slug, tags}）。 */
export function renameTagInPosts<T extends Tagged>(posts: T[], from: string, to: string): { slug: string; tags: string[] }[] {
  const changed: { slug: string; tags: string[] }[] = [];
  for (const p of posts) {
    if (!p.tags.includes(from)) continue;
    changed.push({ slug: p.slug, tags: dedupe(p.tags.map((t) => (t === from ? to : t))) });
  }
  return changed;
}

/** 複数タグ `sources` を `target` に統合した記事だけを返す。 */
export function mergeTagsInPosts<T extends Tagged>(posts: T[], sources: string[], target: string): { slug: string; tags: string[] }[] {
  const src = new Set(sources);
  const changed: { slug: string; tags: string[] }[] = [];
  for (const p of posts) {
    if (!p.tags.some((t) => src.has(t))) continue;
    changed.push({ slug: p.slug, tags: dedupe(p.tags.map((t) => (src.has(t) ? target : t))) });
  }
  return changed;
}

/** タグを削除した記事だけを返す。 */
export function removeTagFromPosts<T extends Tagged>(posts: T[], tag: string): { slug: string; tags: string[] }[] {
  const changed: { slug: string; tags: string[] }[] = [];
  for (const p of posts) {
    if (!p.tags.includes(tag)) continue;
    changed.push({ slug: p.slug, tags: p.tags.filter((t) => t !== tag) });
  }
  return changed;
}
