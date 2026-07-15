"use client";
/** 口コミページ。対象（社内ツール等）を選び、その口コミ一覧・投稿を表示。 */
import * as React from "react";
import { ReviewSection } from "../../components/ReviewSection.js";

const SUBJECTS = [
  { type: "tool", id: "slack", label: "Slack" },
  { type: "tool", id: "notion", label: "Notion" },
  { type: "tool", id: "cafeteria", label: "社員食堂" },
  { type: "tool", id: "office", label: "オフィス環境" },
];

export function ReviewsClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [sel, setSel] = React.useState(SUBJECTS[0]!);
  const [isAdmin, setIsAdmin] = React.useState(false);
  React.useEffect(() => { (async () => { const r = await doFetch("/api/auth/me"); if (r.ok) { const d = (await r.json()) as { user?: { roles: string[] } }; setIsAdmin(!!d.user?.roles.includes("admin")); } })(); }, [doFetch]);
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-bold">口コミ</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        {SUBJECTS.map((s) => <button key={s.id} onClick={() => setSel(s)} className={`rounded-full border px-3 py-1 text-sm ${sel.id === s.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"}`}>{s.label}</button>)}
      </div>
      <ReviewSection subjectType={sel.type} subjectId={sel.id} canModerate={isAdmin} />
    </div>
  );
}
