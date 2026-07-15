"use client";
/** メディアライブラリ。アップロード済み画像を一覧表示し、URL をコピーできる。 */
import * as React from "react";

interface Media { key: string; url: string; name: string; size: number; type: string; uploadedAt: string; }

export interface MediaClientProps { fetchImpl?: typeof fetch; }

export function MediaClient({ fetchImpl }: MediaClientProps) {
  const [media, setMedia] = React.useState<Media[]>([]);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  React.useEffect(() => {
    void (async () => {
      const res = await doFetch("/api/cms/media");
      if (res.ok) setMedia(((await res.json()) as { media: Media[] }).media);
    })();
  }, [doFetch]);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl font-bold">メディアライブラリ</h1>
      {media.length === 0 ? (
        <p className="text-sm text-neutral-500">アップロード済みの画像はまだありません。記事編集からアイキャッチ画像をアップロードすると、ここに一覧されます。</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {media.map((m) => (
            <figure key={m.key} className="overflow-hidden rounded border border-neutral-200">
              <img src={m.url} alt={m.name} className="h-32 w-full object-cover" loading="lazy" />
              <figcaption className="truncate px-2 py-1 text-xs text-neutral-600" title={m.name}>{m.name}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
