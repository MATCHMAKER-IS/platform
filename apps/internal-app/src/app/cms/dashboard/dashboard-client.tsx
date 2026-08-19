"use client";
import { formatDateJst } from "@platform/datetime";
import { AsyncBoundary, PageShell } from "@platform/ui";
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
  published: "bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[var(--color-success)]",
  scheduled: "bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] text-[var(--color-warning)]",
  draft: "bg-[var(--color-subtle)] text-[var(--color-muted)]",
};

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] p-4">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? ""}`}>{value}</p>
    </div>
  );
}

export interface DashboardClientProps { fetchImpl?: typeof fetch; }

export function DashboardClient({ fetchImpl }: DashboardClientProps) {
  const [data, setData] = React.useState<Dashboard | null>(null);
  const [error, setError] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  // **再試行できるように名前を付ける。**
  // 即時関数のままだと、失敗しても呼び直す手段が無い
  const load = React.useCallback(async () => {
    setError("");
      try {
        const res = await doFetch("/api/cms/dashboard");
        // **失敗を握らない。** 握ると「読み込み中…」のまま止まる
        if (!res.ok) { setError("データを取得できませんでした"); return; }
        setData((await res.json()) as Dashboard);
      } catch {
        setError("通信に失敗しました。ネットワークを確認してください");
      }
  }, [doFetch]);

  React.useEffect(() => { void load(); }, [load]);

  // **`AsyncBoundary` に渡す前に返す。** children は JSX なので
  // **この部品が判断するより先に評価される**——`data` が null のままだと
  // `data.…` で画面ごと落ちる(2026-08 の型検査で 7 画面が同じ形だった)。
  if (data === null) {
    return <AsyncBoundary loading={error === ""} error={error} onRetry={() => void load()} />;
  }

  return (
    <AsyncBoundary loading={false} error={error} onRetry={() => void load()}>
        <PageShell title="ダッシュボード" width="wide">
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="記事（合計）" value={data.posts.total} />
        <Stat label="公開中" value={data.posts.published} accent="text-[var(--color-success)]" />
        <Stat label="予約" value={data.posts.scheduled} accent="text-[var(--color-warning)]" />
        <Stat label="下書き" value={data.posts.draft} accent="text-[var(--color-muted)]" />
        <Stat label="固定ページ（公開）" value={data.publishedPageCount} />
        <Stat label="固定ページ（合計）" value={data.pageCount} />
        <Stat label="お知らせ" value={data.announcementCount} />
        <Stat label="カテゴリ" value={data.categoryCount} />
      </div>
      <h2 className="mb-2 text-lg font-semibold">最近更新した記事</h2>
      {data.recent.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">記事がありません。</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {data.recent.map((r) => (
            <li key={r.slug} className="flex items-center justify-between rounded border border-[var(--color-border)] px-3 py-2 text-sm">
              <span className="font-medium">{r.title}</span>
              <span className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                <span className={`rounded px-1.5 py-0.5 ${STATUS_CLASS[r.status] ?? ""}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                {formatDateJst(new Date(r.updatedAt))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
    </AsyncBoundary>
  );
}
