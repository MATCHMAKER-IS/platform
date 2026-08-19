"use client";
/** 口コミページ。対象（社内ツール等）を選び、その口コミ一覧・投稿を表示。 */
import * as React from "react";
import { Button, PageShell } from "@platform/ui";
import { ReviewSection } from "../../components/ReviewSection";

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
        <PageShell title="口コミ" width="narrow">
      <div className="mb-4 flex flex-wrap gap-2">
        {SUBJECTS.map((s) => <Button key={s.id} onClick={() => setSel(s)} variant="tab" data-state={sel.id === s.id ? "active" : undefined}>{s.label}</Button>)}
      </div>
      <ReviewSection subjectType={sel.type} subjectId={sel.id} canModerate={isAdmin} />
    </PageShell>
  );
}
