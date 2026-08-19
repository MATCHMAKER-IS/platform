"use client";
/** アンケート集計結果。選択肢の件数(棒)、評価の平均・分布、自由記述の一覧を表示。 */
import * as React from "react";
import { AsyncBoundary } from "@platform/ui";

interface QResult { id: string; text: string; type: string; options?: { label: string; count: number }[]; average?: number; distribution?: number[]; texts?: string[]; answered: number; }
interface Result { surveyId: string; total: number; questions: QResult[]; }
interface Survey { title: string }

export function ResultsClient({ surveyId, fetchImpl }: { surveyId: string; fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [data, setData] = React.useState<{ survey: Survey; result: Result } | null>(null);
  const [error, setError] = React.useState("");
  // **再試行できるように名前を付ける。**
  // 即時関数のままだと、失敗しても呼び直す手段が無い
  const load = React.useCallback(async () => {
    setError("");
    try {
      const r = await doFetch(`/api/surveys/${surveyId}/results`);
      if (!r.ok) { setError("集計を取得できませんでした"); return; }
      setData((await r.json()) as { survey: Survey; result: Result });
    } catch {
      setError("通信に失敗しました。ネットワークを確認してください");
    }
  }, [doFetch, surveyId]);

  React.useEffect(() => { void load(); }, [load]);

  const bar = (label: string, count: number, max: number) => (
    <div key={label} className="flex items-center gap-2 text-sm"><span className="w-32 truncate text-[var(--color-muted)]">{label}</span><span className="h-4 rounded bg-[var(--color-primary)]" style={{ width: `${max > 0 ? (count / max) * 60 : 0}%` }}></span><span className="text-[var(--color-muted)]">{count}</span></div>
  );
  // **`AsyncBoundary` に渡す前に返す。** children は JSX なので
  // **この部品が判断するより先に評価される**——`data` が null のままだと
  // `data.survey` で画面ごと落ちる。
  if (data === null) {
    return <AsyncBoundary loading={error === ""} error={error} onRetry={() => void load()} />;
  }

  const { survey, result } = data;

  return (
    <AsyncBoundary loading={false} error={error} onRetry={() => void load()}>
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">{survey.title} — 集計</h1>
      <p className="mb-4 text-sm text-[var(--color-muted)]">回答数: {result.total}</p>
      <div className="space-y-4">
        {result.questions.map((q) => (
          <div key={q.id} className="rounded border border-[var(--color-border)] p-3">
            <p className="mb-2 text-sm font-medium">{q.text} <span className="text-xs text-[var(--color-muted)]">(回答 {q.answered})</span></p>
            {q.options && <div className="space-y-1">{(() => { const max = Math.max(1, ...q.options.map((o) => o.count)); return q.options.map((o) => bar(o.label, o.count, max)); })()}</div>}
            {q.type === "rating" && q.distribution && (
              <div>
                <p className="mb-1 text-sm">平均: <span className="font-bold">{(q.average ?? 0).toFixed(2)}</span> / 5</p>
                <div className="space-y-1">{(() => { const max = Math.max(1, ...q.distribution!); return q.distribution!.map((c, i) => bar(`★${i + 1}`, c, max)); })()}</div>
              </div>
            )}
            {q.type === "text" && <ul className="space-y-1 text-sm text-[var(--color-fg)]">{(q.texts ?? []).map((t, i) => <li key={i} className="rounded bg-[var(--color-subtle)] px-2 py-1">{t}</li>)}{(q.texts ?? []).length === 0 && <li className="text-xs text-[var(--color-muted)]">回答なし</li>}</ul>}
          </div>
        ))}
      </div>
    </div>
    </AsyncBoundary>
  );
}
