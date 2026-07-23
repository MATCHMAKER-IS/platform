"use client";
/** 承認インボックス。発注・請求の承認待ちを一覧し、段ごとに承認/却下する。 */
import * as React from "react";
import { Button } from "@platform/ui";
import { ApprovalSignaturePanel } from "../../components/ApprovalSignaturePanel";

interface Event { step: string; action: string; actor: string; at: string; }
interface Approval { docType: string; docNumber: string; amount: number; status: string; currentStep: number; totalSteps: number; submittedAt: string; history: Event[]; }

const yen = (n: number) => `¥${n.toLocaleString()}`;
const DOC_LABEL: Record<string, string> = { purchase: "発注", invoice: "請求" };

export interface ApprovalsClientProps { fetchImpl?: typeof fetch; }

export function ApprovalsClient({ fetchImpl }: ApprovalsClientProps) {
  const [pending, setPending] = React.useState<Approval[]>([]);
  const [error, setError] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch("/api/approvals");
    if (res.ok) setPending(((await res.json()) as { pending: Approval[] }).pending);
  }, [doFetch]);
  React.useEffect(() => { void reload(); }, [reload]);

  const decide = async (a: Approval, action: "approve" | "reject") => {
    setError("");
    let reason: string | undefined;
    if (action === "reject") { reason = "却下"; }
    const res = await doFetch("/api/approvals/decision", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ docType: a.docType, docNumber: a.docNumber, action, reason }) });
    if (res.ok) await reload();
    else setError(((await res.json()) as { error?: string }).error ?? "決裁に失敗しました");
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-bold">承認インボックス</h1>
      <p className="mb-4 text-xs text-neutral-500">発注・請求の承認待ちです。金額に応じて段数が変わります（〜10万:1段、〜50万:2段、それ以上:3段）。各段の担当ロールのみ承認できます。</p>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {pending.length === 0 && <p className="rounded border border-neutral-200 p-6 text-center text-sm text-neutral-500">承認待ちの申請はありません。</p>}

      <div className="space-y-3">
        {pending.map((a) => (
          <div key={`${a.docType}:${a.docNumber}`} className="rounded border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{DOC_LABEL[a.docType] ?? a.docType}</span>
                <span className="ml-2 font-medium">{a.docNumber}</span>
                <span className="ml-2 text-sm text-neutral-500">{yen(a.amount)}</span>
              </div>
              <span className="text-xs text-neutral-500">{a.currentStep + 1} / {a.totalSteps} 段目</span>
            </div>
            {a.history.length > 0 && (
              <div className="mt-2 text-xs text-neutral-500">
                {a.history.map((h, i) => <span key={i} className="mr-3">✓ {h.step}（{h.actor}）</span>)}
              </div>
            )}
            <ApprovalSignaturePanel docType={a.docType} docNumber={a.docNumber} required={a.amount >= 1000000} />
            <div className="mt-3 flex gap-2">
              <Button onClick={() => decide(a, "approve")} className="rounded bg-neutral-900 px-4 py-1.5 text-sm text-white">承認</Button>
              <Button onClick={() => decide(a, "reject")} className="rounded border border-red-300 px-4 py-1.5 text-sm text-red-700">却下</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
