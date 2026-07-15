"use client";
/** CMS ダッシュボード。記事の状態別件数・各コンテンツ数・最近の更新を表示。 */
import * as React from "react";

interface Dashboard {
  posts: { total: number; published: number; draft: number; scheduled: number };
  pageCount: number;
  publishedPageCount: number;
  announcementCount: number;
  categoryCount: number;
  recent: { slug: string; title: string; updatedAt: string; status: string }[];
}

const STATUS_LABEL: Record<string, string> = { published: "公開中", scheduled: "予約", draft: "下書き" };
const STATUS_CLASS: Record<string, string> = {
  published: "bg-green-100 text-green-700",
  scheduled: "bg-amber-100 text-amber-700",
  draft: "bg-neutral-100 text-neutral-600",
};

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? ""}`}>{value}</p>
    </div>
  );
}

export interface DashboardClientProps { fetchImpl?: typeof fetch; }

export function DashboardClient({ fetchImpl }: DashboardClientProps) {
  const [data, setData] = React.useState<Dashboard | null>(null);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  React.useEffect(() => {
    void (async () => {
      const res = await doFetch("/api/cms/dashboard");
      if (res.ok) setData((await res.json()) as Dashboard);
    })();
  }, [doFetch]);

  if (!data) return <div className="mx-auto max-w-4xl p-6 text-sm text-neutral-500">読み込み中…</div>;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl font-bold">ダッシュボード</h1>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="記事（合計）" value={data.posts.total} />
        <Stat label="公開中" value={data.posts.published} accent="text-green-700" />
        <Stat label="予約" value={data.posts.scheduled} accent="text-amber-700" />
        <Stat label="下書き" value={data.posts.draft} accent="text-neutral-500" />
        <Stat label="固定ページ（公開）" value={data.publishedPageCount} />
        <Stat label="固定ページ（合計）" value={data.pageCount} />
        <Stat label="お知らせ" value={data.announcementCount} />
        <Stat label="カテゴリ" value={data.categoryCount} />
      </div>
      <h2 className="mb-2 text-lg font-semibold">最近更新した記事</h2>
      {data.recent.length === 0 ? (
        <p className="text-sm text-neutral-500">記事がありません。</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {data.recent.map((r) => (
            <li key={r.slug} className="flex items-center justify-between rounded border border-neutral-200 px-3 py-2 text-sm">
              <span className="font-medium">{r.title}</span>
              <span className="flex items-center gap-2 text-xs text-neutral-500">
                <span className={`rounded px-1.5 py-0.5 ${STATUS_CLASS[r.status] ?? ""}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                {r.updatedAt.slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
