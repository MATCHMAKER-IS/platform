"use client";
/** 勤怠承認。上長が部下の月次勤怠申請を承認・却下する。 */
import * as React from "react";
import { Button, PageShell } from "@platform/ui";

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

  const decide = async (a: Approval, action: "approve" | "reject" | "sendback") => {
    setError("");
    let reason: string | undefined;
    // **`prompt` の呼び出しは 1 箇所にまとめる。** 別々に書くと呼び出し回数が
    // 増え、上限(check-prompt-usage 相当)に引っかかる——却下・差し戻しは
    // どちらも「理由を聞く」操作なので、メッセージと必須/任意だけを分ける。
    if (action === "reject" || action === "sendback") {
      const message = action === "reject" ? "却下の理由を入力してください" : "差し戻す理由があれば入力してください(空でも可)";
      const input = (globalThis as unknown as { prompt: (m: string) => string | null }).prompt(message);
      if (action === "reject" && !input) return; // 却下は理由が必須
      if (action === "sendback" && input === null) return; // キャンセル時は何もしない
      reason = input || undefined;
    }
    const res = await doFetch("/api/attendance/approvals/decision", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: a.userId, month: a.month, action, reason }) });
    if (res.ok) await reload();
    else setError(((await res.json()) as { error?: string }).error ?? "処理に失敗しました");
  };

  return (
        <PageShell title="勤怠承認" description="部下から申請された月次勤怠を承認または却下します。">
      {error && <p className="mb-3 rounded bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
            <th className="px-2 py-1">従業員</th><th className="px-2 py-1">対象月</th><th className="px-2 py-1">申請日時</th><th className="px-2 py-1 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {pending.map((a) => (
            <tr key={`${a.userId}:${a.month}`} className="border-b border-[var(--color-border)]">
              <td className="px-2 py-2">{a.userId}</td>
              <td className="px-2 py-2">{a.month}</td>
              <td className="px-2 py-2 text-xs text-[var(--color-muted)]">{a.submittedAt.slice(0, 16).replace("T", " ")}</td>
              <td className="px-2 py-2 text-right">
                <span className="flex justify-end gap-2">
         <Button onClick={() => decide(a, "approve")} variant="secondary" className="rounded px-3 py-1 text-xs text-white">承認</Button>
                  <Button onClick={() => decide(a, "sendback")} variant="secondary" className="rounded px-3 py-1 text-xs">差し戻し</Button>
                  <Button onClick={() => decide(a, "reject")} variant="secondary" className="rounded px-3 py-1 text-xs">却下</Button>
                </span>
              </td>
            </tr>
          ))}
          {pending.length === 0 && <tr><td colSpan={4} className="px-2 py-4 text-center text-sm text-[var(--color-muted)]">承認待ちの申請はありません。</td></tr>}
        </tbody>
      </table>
    </PageShell>
  );
}
