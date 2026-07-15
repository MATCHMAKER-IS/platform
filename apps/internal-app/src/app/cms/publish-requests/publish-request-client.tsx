"use client";
/** 公開申請の承認画面。承認者(cms:publish)が申請を承認/却下する。 */
import * as React from "react";

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
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl font-bold">公開申請の承認</h1>
      <div className="mb-3 flex gap-1">
        <button onClick={() => setTab("pending")} className={tab === "pending" ? "rounded bg-neutral-900 px-3 py-1 text-sm text-white" : "rounded border border-neutral-300 px-3 py-1 text-sm"}>承認待ち</button>
        <button onClick={() => setTab("all")} className={tab === "all" ? "rounded bg-neutral-900 px-3 py-1 text-sm text-white" : "rounded border border-neutral-300 px-3 py-1 text-sm"}>すべて</button>
      </div>
      {requests.length === 0 ? (
        <p className="text-sm text-neutral-500">{tab === "pending" ? "承認待ちの申請はありません。" : "申請はありません。"}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded border border-neutral-200 px-3 py-2">
              <div>
                <p className="font-medium">{r.postSlug}</p>
                <p className="text-xs text-neutral-500">
                  申請: {r.requestedBy}・{r.requestedAt.slice(0, 16).replace("T", " ")}
                  <span className="ml-2">{STATUS_LABEL[r.status] ?? r.status}</span>
                  {r.decidedBy && <span className="ml-2">→ {r.decidedBy}</span>}
                  {r.note && <span className="ml-2">「{r.note}」</span>}
                </p>
              </div>
              {r.status === "pending" && (
                <div className="flex gap-2 text-sm">
                  <button onClick={() => decide(r.id, "approved")} className="rounded bg-green-600 px-3 py-1 text-white">承認して公開</button>
                  <button onClick={() => decide(r.id, "rejected")} className="rounded border border-neutral-300 px-3 py-1">却下</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
