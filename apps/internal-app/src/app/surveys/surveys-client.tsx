"use client";
/** アンケート一覧・作成。設問(単一/複数/評価/自由記述)を組み立てて公開する。 */
import * as React from "react";
import { Button, Checkbox, Input } from "@platform/ui";

interface Survey { id: string; title: string; description: string; questions: unknown[]; status: string; createdAt: string; }
type QType = "single" | "multi" | "text" | "rating";
interface Draft { text: string; type: QType; options: string }
const STATUS_LABEL: Record<string, string> = { draft: "下書き", open: "公開中", closed: "終了" };
const TYPE_LABEL: Record<QType, string> = { single: "単一選択", multi: "複数選択", rating: "評価(1-5)", text: "自由記述" };

export function SurveysClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [surveys, setSurveys] = React.useState<Survey[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [depts, setDepts] = React.useState("");
  const [roles, setRoles] = React.useState("");
  const [anonymous, setAnonymous] = React.useState(false);
  const [closesAt, setClosesAt] = React.useState("");
  const [questions, setQuestions] = React.useState<Draft[]>([{ text: "", type: "single", options: "" }]);
  const [msg, setMsg] = React.useState("");

  const reload = React.useCallback(async () => { const r = await doFetch("/api/surveys"); if (r.ok) setSurveys(((await r.json()) as { surveys: Survey[] }).surveys); }, [doFetch]);
  React.useEffect(() => { void reload(); }, [reload]);

  const addQ = () => setQuestions((qs) => [...qs, { text: "", type: "single", options: "" }]);
  const setQ = (i: number, patch: Partial<Draft>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const removeQ = (i: number) => setQuestions((qs) => qs.filter((_, j) => j !== i));

  const create = async () => {
    setMsg("");
    if (!title || questions.some((q) => !q.text)) { setMsg("タイトルと全設問の文言を入力してください"); return; }
    const payload = { title, description: desc, anonymous, ...(closesAt ? { closesAt: new Date(closesAt).toISOString() } : {}), audience: { departments: depts.split(",").map((d) => d.trim()).filter(Boolean), roles: roles.split(",").map((r) => r.trim()).filter(Boolean) }, questions: questions.map((q) => ({ text: q.text, type: q.type, ...((q.type === "single" || q.type === "multi") ? { options: q.options.split(",").map((o) => o.trim()).filter(Boolean) } : {}) })) };
    const r = await doFetch("/api/surveys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (r.ok) { setMsg("作成しました（下書き）"); setTitle(""); setDesc(""); setDepts(""); setRoles(""); setAnonymous(false); setClosesAt(""); setQuestions([{ text: "", type: "single", options: "" }]); setCreating(false); await reload(); }
    else setMsg(((await r.json()) as { error?: string }).error ?? "作成に失敗しました");
  };

  const setStatus = async (id: string, status: string) => { await doFetch(`/api/surveys/${id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }); await reload(); };
  const remind = async (id: string) => { const r = await doFetch(`/api/surveys/${id}/remind`, { method: "POST" }); if (r.ok) { const d = (await r.json()) as { reminded: number }; setMsg(`未回答者 ${d.reminded} 名にリマインドしました`); } };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">アンケート</h1>
        <Button onClick={() => setCreating((v) => !v)} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">{creating ? "閉じる" : "新規作成"}</Button>
      </div>
      {msg && <p className="mb-3 rounded bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{msg}</p>}

      {creating && (
        <div className="mb-6 rounded border border-neutral-200 p-4">
          <label className="text-xs text-neutral-500">タイトル<Input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} className="mt-0.5 mb-2 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
          <label className="text-xs text-neutral-500">説明<Input value={desc} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDesc(e.target.value)} className="mt-0.5 mb-3 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-neutral-500">配信対象の部門（カンマ区切り・空=全員）<Input value={depts} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDepts(e.target.value)} placeholder="営業部, 経理部" className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">配信対象のロール（カンマ区切り）<Input value={roles} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRoles(e.target.value)} placeholder="manager, finance" className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">回答締切（任意）<Input type="datetime-local" value={closesAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClosesAt(e.target.value)} className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="flex items-center gap-2 pt-4 text-xs text-neutral-600"><Checkbox  checked={anonymous} onCheckedChange={(v) => setAnonymous(!!v)} />匿名回答にする（回答者を記録しない）</label>
          </div>
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={i} className="rounded border border-neutral-200 p-2">
                <div className="flex gap-2">
                  <Input value={q.text} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(i, { text: e.target.value })} placeholder={`設問 ${i + 1}`} className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm" />
                  <select value={q.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setQ(i, { type: e.target.value as QType })} className="rounded border border-neutral-300 px-2 py-1 text-sm">
                    {(Object.keys(TYPE_LABEL) as QType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </select>
                  {questions.length > 1 && <Button onClick={() => removeQ(i)} className="text-xs text-neutral-400 hover:underline">削除</Button>}
                </div>
                {(q.type === "single" || q.type === "multi") && <Input value={q.options} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(i, { options: e.target.value })} placeholder="選択肢（カンマ区切り）" className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1 text-xs" />}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2"><Button onClick={addQ} className="rounded border border-neutral-300 px-3 py-1 text-xs">設問を追加</Button><Button onClick={create} className="rounded bg-neutral-900 px-4 py-1 text-sm text-white">作成</Button></div>
        </div>
      )}

      <div className="divide-y divide-neutral-100 rounded border border-neutral-200">
        {surveys.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-3 py-2">
            <div>
              <p className="text-sm font-medium">{s.title} <span className={`ml-1 rounded px-1.5 py-0.5 text-xs ${s.status === "open" ? "bg-green-100 text-green-800" : s.status === "closed" ? "bg-neutral-200 text-neutral-600" : "bg-amber-100 text-amber-800"}`}>{STATUS_LABEL[s.status]}</span></p>
              <p className="text-xs text-neutral-500">{s.questions.length}問</p>
            </div>
            <div className="flex gap-2 text-xs">
              <a href={`/surveys/${s.id}`} className="text-blue-600 hover:underline">回答</a>
              <a href={`/surveys/${s.id}/results`} className="text-blue-600 hover:underline">集計</a>
              {s.status === "draft" && <Button onClick={() => setStatus(s.id, "open")} className="text-green-700 hover:underline">公開</Button>}
              {s.status === "open" && <Button onClick={() => remind(s.id)} className="text-amber-700 hover:underline">リマインド</Button>}
              {s.status === "open" && <Button onClick={() => setStatus(s.id, "closed")} className="text-neutral-500 hover:underline">終了</Button>}
            </div>
          </div>
        ))}
        {surveys.length === 0 && <p className="px-3 py-6 text-center text-sm text-neutral-500">アンケートはありません。</p>}
      </div>
    </div>
  );
}
