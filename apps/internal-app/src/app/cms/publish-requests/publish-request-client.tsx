"use client";
/** 公開申請の承認画面。承認者(cms:publish)が申請を承認/却下する。 */
import * as React from "react";
import { Button, PageShell } from "@platform/ui";

interface PublishRequest {
  id: string;
  postSlug: string;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
}

const STATUS_LABEL: Record<string, string> = { pending: "承認待ち", approved: "承認済み", rejected: "却下" };

export interface PublishRequestClientProps { fetchImpl?: typeof fetch; }

export function PublishRequestClient({ fetchImpl }: PublishRequestClientProps) {
  const [requests, setRequests] = React.useState<PublishRequest[]>([]);
  const [tab, setTab] = React.useState<"pending" | "all">("pending");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch(`/api/cms/publish-requests${tab === "pending" ? "?status=pending" : ""}`);
    if (res.ok) setRequests(((await res.json()) as { requests: PublishRequest[] }).requests);
  }, [doFetch, tab]);

  React.useEffect(() => { void reload(); }, [reload]);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    const note = decision === "rejected" ? (globalThis as unknown as { prompt: (m: string) => string | null }).prompt("却下の理由（任意）") ?? undefined : undefined;
    const res = await doFetch(`/api/cms/publish-requests/${id}/decision`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision, ...(note ? { note } : {}) }) });
    if (res.ok) await reload();
  };

  return (
        <PageShell title="公開申請の承認" width="wide">
      <div className="mb-3 flex gap-1">
        <Button onClick={() => setTab("pending")} variant="tab" data-state={tab === "pending" ? "active" : undefined}>承認待ち</Button>
        <Button onClick={() => setTab("all")} variant="tab" data-state={tab === "all" ? "active" : undefined}>すべて</Button>
      </div>
      {requests.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">{tab === "pending" ? "承認待ちの申請はありません。" : "申請はありません。"}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded border border-[var(--color-border)] px-3 py-2">
              <div>
                <p className="font-medium">{r.postSlug}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  申請: {r.requestedBy}・{r.requestedAt.slice(0, 16).replace("T", " ")}
                  <span className="ml-2">{STATUS_LABEL[r.status] ?? r.status}</span>
                  {r.decidedBy && <span className="ml-2">→ {r.decidedBy}</span>}
                  {r.note && <span className="ml-2">「{r.note}」</span>}
                </p>
              </div>
              {r.status === "pending" && (
                <div className="flex gap-2 text-sm">
         <Button onClick={() => decide(r.id, "approved")} variant="secondary" className="rounded px-3 py-1 text-white">承認して公開</Button>
                  <Button onClick={() => decide(r.id, "rejected")} variant="secondary" className="rounded px-3 py-1">却下</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
