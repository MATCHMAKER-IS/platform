"use client";
/** 承認インボックス。発注・請求の承認待ちを一覧し、段ごとに承認/却下する。 */
import * as React from "react";
import { formatYen } from "@platform/report";
import {
  Button, Checkbox, ConfirmDialog, PromptDialog, PageShell,
  runBulk, createUndoStack, bulkConfirmMessage,
} from "@platform/ui";
import { ApprovalSignaturePanel } from "../../components/ApprovalSignaturePanel";

interface Event { step: string; action: string; actor: string; at: string; }
interface Approval { docType: string; docNumber: string; amount: number; status: string; currentStep: number; totalSteps: number; submittedAt: string; history: Event[]; }

const yen = (n: number) => formatYen(n);
const DOC_LABEL: Record<string, string> = { purchase: "発注", invoice: "請求" };

export interface ApprovalsClientProps { fetchImpl?: typeof fetch; }

export function ApprovalsClient({ fetchImpl }: ApprovalsClientProps) {
  const [pending, setPending] = React.useState<Approval[]>([]);
  const [error, setError] = React.useState("");
  // **どの案件を処理中か。** 行ごとに反応させる(全部止めると他が押せない)
  const [busy, setBusy] = React.useState<string | null>(null);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch("/api/approvals");
    if (res.ok) setPending(((await res.json()) as { pending: Approval[] }).pending);
  }, [doFetch]);
  React.useEffect(() => { void reload(); }, [reload]);

  // **選んだもの。** 100 人規模では**月末に 100 件**上がってきます——
  // **1 件ずつ押すのは現実的でありません**。
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const [bulkResult, setBulkResult] = React.useState<string>("");
  // **取り消しは 5 分だけ。** いつまでも戻せると、
  // **その間に別の人が動かしたものまで壊します**。
  const undoStack = React.useMemo(() => createUndoStack({ ttlMs: 5 * 60_000 }), []);
  const [undoToken, setUndoToken] = React.useState<string | undefined>();

  const toggle = (docNumber: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(docNumber)) next.delete(docNumber);
      else next.add(docNumber);
      return next;
    });
  };

  const decideOne = async (docNumber: string, action: "approve" | "reject"): Promise<void> => {
    const res = await doFetch("/api/approvals/decision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        docNumber, action,
        ...(action === "reject" ? { reason: "却下" } : {}),
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "失敗しました");
    }
  };

  // **確認を挟みます。** `window.confirm` はブラウザ既定の見た目で、
  // **画面の他の部分と揃わず、読み飛ばされます**——基盤の `ConfirmDialog` を使います。
  const [confirming, setConfirming] = React.useState<"approve" | "reject" | null>(null);

  const runBulkDecision = async (action: "approve" | "reject"): Promise<void> => {
    const keys = [...selected];
    if (keys.length === 0) return;

    const label = action === "approve" ? "承認" : "却下";
    setBusy("bulk");
    setError("");
    // **途中で止めません。** 止めると
    // **「どこまで進んだか」を人が調べる**ことになります。
    const result = await runBulk(keys, (k) => decideOne(k, action));
    setBusy(null);
    setSelected(new Set());
    setBulkResult(
      result.failed === 0
        ? `${result.succeeded} 件を${label}しました`
        : `${result.succeeded} 件を${label}、${result.failed} 件が失敗しました`,
    );

    // **成功した分だけ戻せるようにします。**
    // **失敗したものを戻そうとすると、また失敗**します。
    const done = result.items.filter((i) => i.ok).map((i) => i.key);
    if (done.length > 0) {
      setUndoToken(undoStack.register({
        label: `${done.length} 件を${label}`,
        keys: done,
        // **戻すのは「逆の操作」です。** 承認を取り消すなら却下——
        // **完全に元には戻りません**が、**進んでしまった状態は止められます**。
        revert: async (ks) => {
          await runBulk([...ks], (k) => decideOne(k, action === "approve" ? "reject" : "approve"));
          await reload();
        },
      }));
    }
    await reload();
  };

  const undoBulk = async (): Promise<void> => {
    if (undoToken === undefined) return;
    setBusy("undo");
    const r = await undoStack.undo(undoToken);
    setBusy(null);
    setUndoToken(undefined);
    setBulkResult(r.ok ? "取り消しました" : (r.reason ?? "取り消せませんでした"));
  };

  // **差し戻しの理由入力は PromptDialog を使う。** `window.prompt` は
  // 段階的に置き換える方針(基盤のコメント参照)——新規追加は最初から
  // 正しい方法を使う(2026-08、sendback を追加した際に選んだ)。
  const [sendingBack, setSendingBack] = React.useState<Approval | null>(null);

  const decide = async (a: Approval, action: "approve" | "reject" | "sendback") => {
    if (action === "sendback") { setSendingBack(a); return; }
    // **押した後に反応を見せる。**
    // 承認は取り消しに手間がかかる。二重に押されると
    // 「もう 1 段進んでいた」ことに後から気づく
    setBusy(a.docNumber);
    setError("");
    try {
      const reason = action === "reject" ? "却下" : undefined;
      const res = await doFetch("/api/approvals/decision", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ docType: a.docType, docNumber: a.docNumber, action, reason }) });
      if (res.ok) await reload();
      else setError(((await res.json()) as { error?: string }).error ?? "決裁に失敗しました");
    } catch {
      setError("通信に失敗しました。ネットワークを確認してください");
    } finally {
      setBusy(null);
    }
  };

  const submitSendback = async (reason: string): Promise<void> => {
    const a = sendingBack;
    if (!a) return;
    setSendingBack(null);
    setBusy(a.docNumber);
    setError("");
    try {
      const res = await doFetch("/api/approvals/decision", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ docType: a.docType, docNumber: a.docNumber, action: "sendback", ...(reason ? { reason } : {}) }) });
      if (res.ok) await reload();
      else setError(((await res.json()) as { error?: string }).error ?? "決裁に失敗しました");
    } catch {
      setError("通信に失敗しました。ネットワークを確認してください");
    } finally {
      setBusy(null);
    }
  };

  return (
        <PageShell title="承認インボックス" description="発注・請求の承認待ちです。金額に応じて段数が変わります（〜10万:1段、〜50万:2段、それ以上:3段）。各段の担当ロールのみ承認できます。">
      {error && <p className="mb-3 rounded bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}

      {pending.length === 0 && <p className="rounded border border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted)]">承認待ちの申請はありません。</p>}

      {/* **一括操作の帯。** 選んでいるときだけ出します——
          **常に出ていると、押すつもりのないときに押されます**。 */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded bg-[var(--color-subtle)] p-2">
          <span className="text-sm">{selected.size} 件を選択中</span>
          <Button
            onClick={() => { setConfirming("approve"); }}
            disabled={busy !== null}
          >
            まとめて承認
          </Button>
          <Button
            variant="secondary"
            onClick={() => { setConfirming("reject"); }}
            disabled={busy !== null}
          >
            まとめて却下
          </Button>
          <Button variant="ghost" onClick={() => { setSelected(new Set()); }}>
            選択を解除
          </Button>
        </div>
      )}

      {/* **結果と取り消し。** **押した後に戻せる**ことを、
          その場に出します——別の画面に行かせると**戻すのを諦めます**。 */}
      {bulkResult !== "" && (
        <div className="mb-3 flex items-center gap-2 rounded border p-2 text-sm">
          <span>{bulkResult}</span>
          {undoToken !== undefined && (
            <Button
              variant="secondary"
              onClick={() => { void undoBulk(); }}
              disabled={busy !== null}
            >
              取り消す（5 分以内）
            </Button>
          )}
        </div>
      )}

      {/* **件数を必ず見せる。** **100 件を 1 件と間違えたときに気づけます**——
          「本当によろしいですか？」だけでは、**読まずに押されます**。 */}
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(o) => { if (!o) setConfirming(null); }}
        title={`承認待ちを${confirming === "reject" ? "却下" : "承認"}します`}
        description={bulkConfirmMessage({
          subject: "承認待ち",
          count: selected.size,
          action: confirming === "reject" ? "却下" : "承認",
          undoable: true,
        })}
        confirmText={confirming === "reject" ? "却下する" : "承認する"}
        destructive={confirming === "reject"}
        onConfirm={() => {
          const action = confirming;
          setConfirming(null);
          if (action !== null) void runBulkDecision(action);
        }}
      />

      {/* **差し戻しの理由入力。** `window.prompt` ではなく `PromptDialog` を
          使う(基盤の置き換え方針に沿う)。理由は空でも送信できる。 */}
      <PromptDialog
        open={sendingBack !== null}
        onClose={() => setSendingBack(null)}
        onSubmit={(v) => void submitSendback(v)}
        title={`${sendingBack?.docNumber ?? ""} を差し戻す`}
        label="差し戻す理由(空でも可)"
        submitLabel="差し戻す"
      />

      <div className="space-y-3">
        {pending.map((a) => (
          <div key={`${a.docType}:${a.docNumber}`} className="rounded border border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between">
              <div>
                {/* **選ぶための印。** 1 件ずつのボタンも残します——
                    **1 件だけ処理したい人に、選ばせるのは手間**です。 */}
                <Checkbox
                  checked={selected.has(a.docNumber)}
                  onChange={() => { toggle(a.docNumber); }}
                  aria-label={`${a.docNumber} を選ぶ`}
                />
                <span className="rounded bg-[var(--color-subtle)] px-1.5 py-0.5 text-xs">{DOC_LABEL[a.docType] ?? a.docType}</span>
                <span className="ml-2 font-medium">{a.docNumber}</span>
                <span className="ml-2 text-sm text-[var(--color-muted)]">{yen(a.amount)}</span>
              </div>
              <span className="text-xs text-[var(--color-muted)]">{a.currentStep + 1} / {a.totalSteps} 段目</span>
            </div>
            {a.history.length > 0 && (
              <div className="mt-2 text-xs text-[var(--color-muted)]">
                {a.history.map((h, i) => <span key={i} className="mr-3">✓ {h.step}（{h.actor}）</span>)}
              </div>
            )}
            <ApprovalSignaturePanel docType={a.docType} docNumber={a.docNumber} required={a.amount >= 1000000} />
            <div className="mt-3 flex gap-2">
       <Button loading={busy === a.docNumber} loadingLabel="処理中…" onClick={() => void decide(a, "approve")} className="rounded px-4 py-1.5 text-sm text-white">承認</Button>
              <Button loading={busy === a.docNumber} loadingLabel="処理中…" onClick={() => void decide(a, "sendback")} variant="secondary" className="rounded px-4 py-1.5 text-sm">差し戻し</Button>
              <Button loading={busy === a.docNumber} loadingLabel="処理中…" onClick={() => void decide(a, "reject")} variant="danger" className="rounded px-4 py-1.5 text-sm">却下</Button>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
