"use client";
/** アンケート回答フォーム。設問種別に応じた入力を出し、回答を送信する。 */
import * as React from "react";
import { Button, Textarea, RadioGroup, RadioGroupItem, Checkbox } from "@platform/ui";

interface Question { id: string; text: string; type: "single" | "multi" | "text" | "rating"; options?: string[]; }
interface Survey { id: string; title: string; description: string; questions: Question[]; status: string; }

export function RespondClient({ surveyId, fetchImpl }: { surveyId: string; fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [survey, setSurvey] = React.useState<Survey | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, { choice?: string[]; text?: string; rating?: number }>>({});
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => { (async () => { const r = await doFetch(`/api/surveys/${surveyId}`); if (r.ok) setSurvey((await r.json()) as Survey); })(); }, [doFetch, surveyId]);

  const setSingle = (qid: string, v: string) => setAnswers((a) => ({ ...a, [qid]: { choice: [v] } }));
  const toggleMulti = (qid: string, v: string) => setAnswers((a) => { const cur = a[qid]?.choice ?? []; return { ...a, [qid]: { choice: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } }; });
  const setText = (qid: string, v: string) => setAnswers((a) => ({ ...a, [qid]: { text: v } }));
  const setRating = (qid: string, v: number) => setAnswers((a) => ({ ...a, [qid]: { rating: v } }));

  const submit = async () => {
    setError("");
    if (!survey) return;
    const payload = { answers: survey.questions.map((q) => ({ questionId: q.id, ...(answers[q.id] ?? {}) })) };
    const r = await doFetch(`/api/surveys/${surveyId}/respond`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (r.ok) setDone(true);
    else setError(((await r.json()) as { error?: string }).error ?? "送信に失敗しました");
  };

  if (done) return <div className="mx-auto max-w-2xl p-6"><p className="rounded bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] px-4 py-3 text-[var(--color-success)]">ご回答ありがとうございました。</p></div>;
  if (!survey) return <div className="mx-auto max-w-2xl p-6 text-sm text-[var(--color-muted)]">読み込み中…</div>;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">{survey.title}</h1>
      {survey.description && <p className="mb-4 mt-1 text-sm text-[var(--color-muted)]">{survey.description}</p>}
      {error && <p className="mb-3 rounded bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}
      <div className="space-y-4">
        {survey.questions.map((q) => (
          <div key={q.id} className="rounded border border-[var(--color-border)] p-3">
            <p className="mb-2 text-sm font-medium">{q.text}</p>
            {q.type === "single" && (
              /* **選択状態を value で渡す。** 生 input のときは checked を渡しておらず、
                 選んでも見た目が変わらなかった */
              <RadioGroup
                value={answers[q.id]?.choice?.[0] ?? ""}
                onValueChange={(v: string) => setSingle(q.id, v)}
                className="flex flex-wrap gap-3"
              >
                {(q.options ?? []).map((o) => (
                  <label key={o} className="flex items-center gap-1 text-sm">
                    <RadioGroupItem value={o} />{o}
                  </label>
                ))}
              </RadioGroup>
            )}
            {q.type === "multi" && (
              <div className="flex flex-wrap gap-3">
                {(q.options ?? []).map((o) => (
                  <label key={o} className="flex items-center gap-1 text-sm">
                    <Checkbox
                      checked={(answers[q.id]?.choice ?? []).includes(o)}
                      onCheckedChange={() => toggleMulti(q.id, o)}
                    />{o}
                  </label>
                ))}
              </div>
            )}
            {q.type === "text" && <Textarea onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(q.id, e.target.value)} rows={3} className="block w-full rounded border border-[var(--color-border)] px-2 py-1 text-sm" />}
            {q.type === "rating" && <div className="flex gap-2">{[1, 2, 3, 4, 5].map((n) => <Button key={n} onClick={() => setRating(q.id, n)} className={`h-8 w-8 rounded-full border text-sm ${answers[q.id]?.rating === n ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-white" : "border-[var(--color-border)]"}`}>{n}</Button>)}</div>}
          </div>
        ))}
      </div>
      <Button onClick={submit} className="mt-4 rounded bg-[var(--color-fg)] px-6 py-2 text-sm text-white">送信</Button>
    </div>
  );
}
