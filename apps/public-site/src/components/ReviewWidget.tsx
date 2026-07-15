"use client";
/** 公開サイト向け 口コミウィジェット。社内アプリの公開レビューAPIから可視の口コミと平均★を取得して表示。 */
import * as React from "react";

interface Review { author: string; rating: number; title: string; comment: string; createdAt: string; }
interface Summary { count: number; average: number; }
const stars = (n: number) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);

export function ReviewWidget({ subjectType, subjectId, apiBase = "", fetchImpl }: { subjectType: string; subjectId: string; apiBase?: string; fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  React.useEffect(() => {
    (async () => {
      try {
        const r = await doFetch(`${apiBase}/api/public/reviews?subjectType=${encodeURIComponent(subjectType)}&subjectId=${encodeURIComponent(subjectId)}`);
        if (r.ok) { const d = (await r.json()) as { reviews: Review[]; summary: Summary }; setReviews(d.reviews); setSummary(d.summary); }
      } catch { /* オフライン時は非表示 */ }
    })();
  }, [doFetch, apiBase, subjectType, subjectId]);

  if (!summary || summary.count === 0) return null;
  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-semibold">お客様の声</h3>
        <span className="text-amber-600">{stars(Math.round(summary.average))} {summary.average.toFixed(1)}（{summary.count}件）</span>
      </div>
      <ul className="space-y-3">
        {reviews.slice(0, 5).map((r, i) => (
          <li key={i} className="border-b border-neutral-100 pb-2 last:border-0">
            <div className="flex items-center justify-between"><span className="text-amber-500">{stars(r.rating)}</span><span className="text-xs text-neutral-400">{r.author}</span></div>
            {r.title && <p className="text-sm font-medium">{r.title}</p>}
            {r.comment && <p className="text-sm text-neutral-600">{r.comment}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
