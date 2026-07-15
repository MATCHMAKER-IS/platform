"use client";
/** アンケート集計結果。選択肢の件数(棒)、評価の平均・分布、自由記述の一覧を表示。 */
import * as React from "react";

interface QResult { id: string; text: string; type: string; options?: { label: string; count: number }[]; average?: number; distribution?: number[]; texts?: string[]; answered: number; }
interface Result { surveyId: string; total: number; questions: QResult[]; }
interface Survey { title: string }

export function ResultsClient({ surveyId, fetchImpl }: { surveyId: string; fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [data, setData] = React.useState<{ survey: Survey; result: Result } | null>(null);
  React.useEffect(() => { (async () => { const r = await doFetch(`/api/surveys/${surveyId}/results`); if (r.ok) setData((await r.json()) as { survey: Survey; result: Result }); })(); }, [doFetch, surveyId]);
  if (!data) return <div className="mx-auto max-w-2xl p-6 text-sm text-neutral-500">読み込み中…</div>;
  const { survey, result } = data;
  const bar = (label: string, count: number, max: number) => (
    <div key={label} className="flex items-center gap-2 text-sm"><span className="w-32 truncate text-neutral-600">{label}</span><span className="h-4 rounded bg-blue-500" style={{ width: `${max > 0 ? (count / max) * 60 : 0}%` }}></span><span className="text-neutral-500">{count}</span></div>
  );
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">{survey.title} — 集計</h1>
      <p className="mb-4 text-sm text-neutral-500">回答数: {result.total}</p>
      <div className="space-y-4">
        {result.questions.map((q) => (
          <div key={q.id} className="rounded border border-neutral-200 p-3">
            <p className="mb-2 text-sm font-medium">{q.text} <span className="text-xs text-neutral-400">(回答 {q.answered})</span></p>
            {q.options && <div className="space-y-1">{(() => { const max = Math.max(1, ...q.options.map((o) => o.count)); return q.options.map((o) => bar(o.label, o.count, max)); })()}</div>}
            {q.type === "rating" && q.distribution && (
              <div>
                <p className="mb-1 text-sm">平均: <span className="font-bold">{(q.average ?? 0).toFixed(2)}</span> / 5</p>
                <div className="space-y-1">{(() => { const max = Math.max(1, ...q.distribution!); return q.distribution!.map((c, i) => bar(`★${i + 1}`, c, max)); })()}</div>
              </div>
            )}
            {q.type === "text" && <ul className="space-y-1 text-sm text-neutral-700">{(q.texts ?? []).map((t, i) => <li key={i} className="rounded bg-neutral-50 px-2 py-1">{t}</li>)}{(q.texts ?? []).length === 0 && <li className="text-xs text-neutral-400">回答なし</li>}</ul>}
          </div>
        ))}
      </div>
    </div>
  );
}
