"use client";
/** 口コミ表示・投稿。対象(subjectType/subjectId)のレビュー一覧・平均★・投稿フォーム。 */
import * as React from "react";
import { Button, Input, Textarea } from "@platform/ui";

interface Review { id: string; author: string; rating: number; title: string; comment: string; hidden?: boolean; createdAt: string; }
interface Summary { count: number; average: number; distribution: Record<string, number>; }
const stars = (n: number) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);

export function ReviewSection({ subjectType, subjectId, canModerate = false, fetchImpl }: { subjectType: string; subjectId: string; canModerate?: boolean; fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [rating, setRating] = React.useState(5);
  const [title, setTitle] = React.useState("");
  const [comment, setComment] = React.useState("");

  const reload = React.useCallback(async () => {
    const r = await doFetch(`/api/reviews?subjectType=${encodeURIComponent(subjectType)}&subjectId=${encodeURIComponent(subjectId)}`);
    if (r.ok) { const d = (await r.json()) as { reviews: Review[]; summary: Summary }; setReviews(d.reviews); setSummary(d.summary); }
    if (canModerate) { const m = await doFetch(`/api/reviews/moderate?subjectType=${encodeURIComponent(subjectType)}&subjectId=${encodeURIComponent(subjectId)}`); if (m.ok) setReviews(((await m.json()) as { reviews: Review[] }).reviews); }
  }, [doFetch, subjectType, subjectId, canModerate]);
  const setHidden = async (id: string, hidden: boolean) => {
    await doFetch("/api/reviews/moderate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, hidden }) });
    await reload();
  };
  React.useEffect(() => { void reload(); }, [reload]);

  const submit = async () => {
    const r = await doFetch("/api/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subjectType, subjectId, rating, title, comment }) });
    if (r.ok) { setTitle(""); setComment(""); setRating(5); await reload(); }
  };

  return (
    <div className="rounded border border-[var(--color-border)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-medium">口コミ</h3>
        {summary && summary.count > 0 && <span className="text-sm text-[var(--color-warning)]">{stars(Math.round(summary.average))} {summary.average.toFixed(1)}（{summary.count}件）</span>}
      </div>
      <div className="mb-4 rounded bg-[var(--color-subtle)] p-3">
        <div className="mb-2 flex gap-1">{[1, 2, 3, 4, 5].map((n) => <Button key={n} type="button" aria-label={`${n}つ星`} title={`${n}つ星`} onClick={() => setRating(n)} variant="star" data-state={n <= rating ? "on" : undefined}>★</Button>)}</div>
        <Input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="タイトル" className="mb-2 block w-full rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
        <Textarea value={comment} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)} rows={2} placeholder="コメント" className="mb-2 block w-full rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
    <Button type="button" onClick={submit} className="rounded px-4 py-1.5 text-sm text-white">投稿する</Button>
      </div>
      <ul className="space-y-2">
        {reviews.map((r) => (
          <li key={r.id} className={`border-b border-[var(--color-border)] pb-2 ${r.hidden ? "opacity-50" : ""}`}>
            <div className="flex items-center justify-between"><span className="text-sm text-[var(--color-warning)]">{stars(r.rating)}{r.hidden && <span className="ml-2 rounded bg-[var(--color-subtle-strong)] px-1 text-xs text-[var(--color-muted)]">非表示</span>}</span><span className="text-xs text-[var(--color-muted)]">{r.author}</span></div>
            {r.title && <p className="text-sm font-medium">{r.title}</p>}
            {r.comment && <p className="text-sm text-[var(--color-muted)]">{r.comment}</p>}
      {canModerate && <Button type="button" onClick={() => setHidden(r.id, !r.hidden)} variant="secondary" className="mt-1 text-xs hover:underline">{r.hidden ? "再表示" : "非表示にする"}</Button>}
          </li>
        ))}
        {reviews.length === 0 && <li className="text-sm text-[var(--color-muted)]">まだ口コミはありません。</li>}
      </ul>
    </div>
  );
}
