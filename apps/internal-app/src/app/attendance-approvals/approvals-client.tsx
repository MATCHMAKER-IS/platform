"use client";
/** 勤怠承認。上長が部下の月次勤怠申請を承認・却下する。 */
import * as React from "react";

interface Event { step: string; action: string; actor: string; at: string; }
interface Approval { userId: string; month: string; status: string; submittedAt: string; history: Event[]; }

export interface ApprovalsClientProps { fetchImpl?: typeof fetch; }

export function ApprovalsClient({ fetchImpl }: ApprovalsClientProps) {
  const [pending, setPending] = React.useState<Approval[]>([]);
  const [error, setError] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch("/api/attendance/approvals");
    if (res.ok) setPending(((await res.json()) as { pending: Approval[] }).pending);
  }, [doFetch]);
  React.useEffect(() => { void reload(); }, [reload]);

  const decide = async (a: Approval, action: "approve" | "reject") => {
    setError("");
    let reason: string | undefined;
    if (action === "reject") {
      const input = (globalThis as unknown as { prompt: (m: string) => string | null }).prompt("却下の理由を入力してください");
      if (!input) return;
      reason = input;
    }
    const res = await doFetch("/api/attendance/approvals/decision", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: a.userId, month: a.month, action, reason }) });
    if (res.ok) await reload();
    else setError(((await res.json()) as { error?: string }).error ?? "処理に失敗しました");
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-bold">勤怠承認</h1>
      <p className="mb-4 text-xs text-neutral-500">部下から申請された月次勤怠を承認または却下します。</p>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="px-2 py-1">従業員</th><th className="px-2 py-1">対象月</th><th className="px-2 py-1">申請日時</th><th className="px-2 py-1 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {pending.map((a) => (
            <tr key={`${a.userId}:${a.month}`} className="border-b border-neutral-100">
              <td className="px-2 py-2">{a.userId}</td>
              <td className="px-2 py-2">{a.month}</td>
              <td className="px-2 py-2 text-xs text-neutral-500">{a.submittedAt.slice(0, 16).replace("T", " ")}</td>
              <td className="px-2 py-2 text-right">
                <span className="flex justify-end gap-2">
                  <button onClick={() => decide(a, "approve")} className="rounded bg-green-600 px-3 py-1 text-xs text-white">承認</button>
                  <button onClick={() => decide(a, "reject")} className="rounded border border-neutral-300 px-3 py-1 text-xs">却下</button>
                </span>
              </td>
            </tr>
          ))}
          {pending.length === 0 && <tr><td colSpan={4} className="px-2 py-4 text-center text-sm text-neutral-500">承認待ちの申請はありません。</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
