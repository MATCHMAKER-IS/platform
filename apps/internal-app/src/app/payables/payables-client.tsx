"use client";
/** 買掛金。エイジング（5区分）、支払予定一覧、発注への支払記録。 */
import * as React from "react";
import { formatYen } from "@platform/report";
import { PromptDialog, Button, PageShell } from "@platform/ui";

interface Aging { current: number; d1_30: number; d31_60: number; d61_90: number; over90: number; total: number; }
interface Due { number: string; supplier: string; dueDate: string; amountDue: number; overdueDays: number; }
interface Summary { aging: Aging; outstanding: number; upcoming: Due[]; }
/** 下請法の指摘 1 件(`@platform/contract` の `SubcontractIssue` と同じ形)。 */
interface SubIssue { orderId: string; severity: "violation" | "warning"; message: string; law: string; }
/** 下請法チェックの結果。**適用外なら `applies: false`** で、以降は見なくてよい。 */
interface Compliance { applies: boolean; reason?: string; issues: SubIssue[]; summary: { violation: number; warning: number; lateInterestJpy: number } }

const yen = (n: number) => formatYen(n);

export interface PayablesClientProps { fetchImpl?: typeof fetch; canPay?: boolean; }

export function PayablesClient({ fetchImpl, canPay = true }: PayablesClientProps) {
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [error, setError] = React.useState("");
  // 支払を記録しようとしている明細(null なら尋ねない)
  const [paying, setPaying] = React.useState<Due | null>(null);
  // **下請法の遵守状況。** 支払期日は「受領日から 60 日以内」を暦日で数えるので、
  // 「月末締め翌々月末払い」は月によって超える——**慣行のままだと気づかず違反し続ける**。
  // 基盤に `checkSubcontractCompliance` があるのに、2026-08 まで呼ばれていなかった。
  const [compliance, setCompliance] = React.useState<Compliance | null>(null);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch("/api/payables");
    if (res.ok) setSummary((await res.json()) as Summary);
  }, [doFetch]);
  React.useEffect(() => { void reload(); }, [reload]);

  // **資本金は取引先マスタに持たせるのが本来の形。** ここは可視化の前段なので、
  // 環境変数で渡された自社の資本金と、既定の相手資本金で「まず見えるように」する。
  React.useEffect(() => {
    void (async () => {
      const q = new URLSearchParams({ ownCapital: "50000000", partnerCapital: "5000000", type: "program" });
      const res = await doFetch(`/api/subcontract-compliance?${q.toString()}`);
      if (res.ok) setCompliance((await res.json()) as Compliance);
    })();
  }, [doFetch]);

  /**
   * 支払を記録する。
   *
   * **金額は画面で受ける。** `window.prompt` は入力の種類を指定できず、
   * 数字以外を入れられても閉じるまで気づけない。
   * 支払は金額を間違えると帳簿が合わなくなる。
   */
  const pay = async (d: Due, amount: number) => {
    setError("");
    const res = await doFetch(`/api/payables/${d.number}/payment`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount }) });
    if (res.ok) await reload();
    else setError(((await res.json()) as { error?: string }).error ?? "支払記録に失敗しました");
  };

  return (
        <PageShell title="買掛金" width="wide" description="発注に対する未払と支払予定です。支払を記録すると未払残に反映されます。">
      {error && <p className="mb-3 rounded bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}

      {summary && (
        <>
          {compliance?.applies && (compliance.issues.length > 0 || compliance.summary.lateInterestJpy > 0) && (
            <div className="mb-6 rounded border border-[var(--color-danger)] p-4">
              <h2 className="mb-2 text-sm font-medium">
                下請法の確認
                {compliance.summary.violation > 0 && (
                  <span className="ml-2 rounded bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] px-2 py-0.5 text-xs text-[var(--color-danger)]">
                    違反 {compliance.summary.violation} 件
                  </span>
                )}
                {compliance.summary.warning > 0 && (
                  <span className="ml-2 rounded bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] px-2 py-0.5 text-xs text-[var(--color-warning)]">
                    注意 {compliance.summary.warning} 件
                  </span>
                )}
              </h2>
              {/* **金額で出す。** 「違反 3 件」より「遅延利息 12,400 円」の方が、
                  経理にも経営にも伝わる。年 14.6%（法定）。 */}
              {compliance.summary.lateInterestJpy > 0 && (
                <p className="mb-2 text-sm text-[var(--color-danger)]">
                  遅延利息の見込み <strong>{yen(compliance.summary.lateInterestJpy)}</strong>（年 14.6%・法定）
                </p>
              )}
              <ul className="space-y-1 text-sm">
                {compliance.issues.slice(0, 5).map((v, i) => (
                  <li key={`${v.orderId}-${i}`} className={v.severity === "violation" ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]"}>
                    {v.severity === "violation" ? "⚠ " : "△ "}
                    {v.orderId}: {v.message}
                    <span className="ml-1 text-xs text-[var(--color-muted)]">（{v.law}）</span>
                  </li>
                ))}
              </ul>
              {compliance.issues.length > 5 && (
                <p className="mt-1 text-xs text-[var(--color-muted)]">ほか {compliance.issues.length - 5} 件</p>
              )}
            </div>
          )}

          <div className="mb-6 rounded border border-[var(--color-border)] p-4">
            <h2 className="mb-2 text-sm font-medium">買掛金エイジング（未払 {yen(summary.outstanding)}）</h2>
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              <div className="rounded bg-[var(--color-subtle)] p-2"><div className="text-[var(--color-muted)]">期限前</div><div className="font-medium">{yen(summary.aging.current)}</div></div>
              <div className="rounded bg-[color-mix(in_srgb,var(--color-warning)_8%,transparent)] p-2"><div className="text-[var(--color-warning)]">1〜30日</div><div className="font-medium">{yen(summary.aging.d1_30)}</div></div>
              <div className="rounded bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] p-2"><div className="text-[var(--color-warning)]">31〜60日</div><div className="font-medium">{yen(summary.aging.d31_60)}</div></div>
              <div className="rounded bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] p-2"><div className="text-[var(--color-danger)]">61〜90日</div><div className="font-medium">{yen(summary.aging.d61_90)}</div></div>
              <div className="rounded bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] p-2"><div className="text-[var(--color-danger)]">90日超</div><div className="font-medium">{yen(summary.aging.over90)}</div></div>
            </div>
          </div>

          <h2 className="mb-2 text-sm font-medium">支払予定</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
                <th className="px-2 py-1">発注</th><th className="px-2 py-1">仕入先</th><th className="px-2 py-1">支払期限</th><th className="px-2 py-1 text-right">未払額</th><th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {summary.upcoming.map((d) => (
                <tr key={d.number} className="border-b border-[var(--color-border)]">
                  <td className="px-2 py-2 font-mono text-xs">{d.number}</td>
                  <td className="px-2 py-2">{d.supplier}</td>
                  <td className="px-2 py-2 text-xs">{d.dueDate}{d.overdueDays > 0 && <span className="ml-1 rounded bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] px-1.5 py-0.5 text-[var(--color-danger)]">{d.overdueDays}日超過</span>}</td>
                  <td className="px-2 py-2 text-right font-medium">{yen(d.amountDue)}</td>
         <td className="px-2 py-2 text-right">{canPay && <Button variant="ghost" onClick={() => setPaying(d)} className="text-[var(--color-primary)] hover:underline">支払記録</Button>}</td>
                </tr>
              ))}
              {summary.upcoming.length === 0 && <tr><td colSpan={5} className="px-2 py-4 text-center text-sm text-[var(--color-muted)]">未払の買掛金はありません。</td></tr>}
            </tbody>
          </table>
        </>
      )}
      {/* **既定は残額。** そのまま押せば全額払える(よくある操作を短く) */}
      <PromptDialog
        open={paying !== null}
        onClose={() => setPaying(null)}
        onSubmit={(v) => { if (paying !== null) void pay(paying, Number(v)); }}
        title={paying !== null ? `${paying.supplier}(${paying.number})への支払` : ""}
        label="支払額(円)"
        type="number"
        defaultValue={paying !== null ? String(paying.amountDue) : ""}
        submitLabel="記録する"
        validate={(v) => (Number(v) > 0 ? undefined : "1 円以上を入力してください")}
      />
    </PageShell>
  );
}
