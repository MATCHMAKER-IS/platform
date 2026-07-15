"use client";
/** 会計。請求・入金・仕入から自動生成した仕訳と試算表を表示。貸借一致を確認できる。 */
import * as React from "react";

interface Row { date: string; description: string; account: string; debit: number; credit: number; }
interface Balance { account: string; debit: number; credit: number; balance: number; }
interface Ledger { rows: Row[]; trialBalance: Balance[]; balanced: boolean; entries: { date: string }[]; }
interface LedgerLine { date: string; description: string; debit: number; credit: number; balance: number; memo?: string; }
interface AccountLedger { account: string; lines: LedgerLine[]; debitTotal: number; creditTotal: number; closingBalance: number; }
interface ManualRow { date: string; description: string; account: string; debit: number; credit: number; memo?: string; }
interface AccountDef { account: string; type: string; }
interface FreeeBatch { summary: { total: number; ready: number; errors: number }; errors: { key: string; unknownAccounts: string[] }[]; }

const yen = (n: number) => (n === 0 ? "—" : `¥${n.toLocaleString()}`);

export interface AccountingClientProps { fetchImpl?: typeof fetch; }

export function AccountingClient({ fetchImpl }: AccountingClientProps) {
  const [ledger, setLedger] = React.useState<Ledger | null>(null);
  const [freee, setFreee] = React.useState<FreeeBatch | null>(null);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [detail, setDetail] = React.useState<AccountLedger | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [jcsv, setJcsv] = React.useState("");
  const [importMsg, setImportMsg] = React.useState("");
  const [manual, setManual] = React.useState<ManualRow[] | null>(null);

  const loadManual = React.useCallback(async () => {
    const res = await doFetch("/api/accounting/journal-entries");
    if (res.ok) setManual(((await res.json()) as { rows: ManualRow[] }).rows);
  }, [doFetch]);
  React.useEffect(() => { void loadManual(); }, [loadManual]);

  const [accounts, setAccounts] = React.useState<AccountDef[] | null>(null);
  const [acctForm, setAcctForm] = React.useState({ account: "", type: "expense" });
  const [showAccounts, setShowAccounts] = React.useState(false);
  const loadAccounts = React.useCallback(async () => {
    const res = await doFetch("/api/accounting/accounts");
    if (res.ok) setAccounts(((await res.json()) as { accounts: AccountDef[] }).accounts);
  }, [doFetch]);
  React.useEffect(() => { void loadAccounts(); }, [loadAccounts]);
  const saveAccount = async () => {
    if (!acctForm.account.trim()) return;
    const res = await doFetch("/api/accounting/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(acctForm) });
    if (res.ok) { setAcctForm({ account: "", type: "expense" }); await loadAccounts(); }
  };
  const removeAccount = async (account: string) => {
    const res = await doFetch("/api/accounting/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account, remove: true }) });
    if (res.ok) await loadAccounts();
  };
  const TYPE_LABEL: Record<string, string> = { asset: "資産", liability: "負債", equity: "純資産", revenue: "収益", expense: "費用" };


  const onJournalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setJcsv(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const runJournalImport = async () => {
    setImportMsg("");
    if (!jcsv.trim()) { setImportMsg("CSV を貼り付けるかファイルを選択してください"); return; }
    const res = await doFetch("/api/accounting/journal-import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ csv: jcsv }) });
    if (res.ok) {
      const d = (await res.json()) as { imported: number; errors: { line: number; message: string }[] };
      setImportMsg(`${d.imported} 件の仕訳を取り込みました${d.errors.length ? `（エラー ${d.errors.length} 件: ` + d.errors.map((e) => `${e.line}行目 ${e.message}`).join(" / ") + "）" : ""}`);
      setJcsv(""); await loadManual();
    } else setImportMsg(((await res.json()) as { error?: string }).error ?? "取り込みに失敗しました");
  };


  const showLedger = async (account: string) => {
    const res = await doFetch(`/api/accounting/ledger?account=${encodeURIComponent(account)}`);
    if (res.ok) setDetail(((await res.json()) as { ledger: AccountLedger }).ledger);
  };


  React.useEffect(() => {
    void (async () => {
      const res = await doFetch("/api/accounting");
      if (res.ok) setLedger((await res.json()) as Ledger);
    })();
  }, [doFetch]);

  const exportFreee = async () => {
    const res = await doFetch("/api/accounting/freee");
    if (res.ok) setFreee((await res.json()) as FreeeBatch);
  };

  if (!ledger) return <div className="mx-auto max-w-5xl p-6"><div className="flex items-center gap-2"><h1 className="text-2xl font-bold">会計</h1></div><p className="mt-4 text-sm text-neutral-500">読み込み中…</p></div>;

  const totalDebit = ledger.trialBalance.reduce((s, b) => s + b.debit, 0);
  const totalCredit = ledger.trialBalance.reduce((s, b) => s + b.credit, 0);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold">会計</h1>
        <span className="flex gap-2"><a href="/api/accounting/export" className="rounded border border-neutral-300 px-4 py-2 text-sm">仕訳帳CSV</a><button onClick={exportFreee} className="rounded border border-neutral-300 px-4 py-2 text-sm">freee 形式で書き出し</button></span>
      </div>
      <p className="mb-4 text-xs text-neutral-500">請求（売上）・入金・仕入から仕訳を自動生成しています。会計ソフト取込用の元データです。</p>
      {freee && (
        <div className="mb-6 rounded border border-neutral-200 bg-neutral-50 p-4 text-sm">
          <p>freee 送信用バッチ：全 {freee.summary.total} 件中 <span className="font-medium text-green-700">{freee.summary.ready} 件が送信可能</span>{freee.summary.errors > 0 && <span className="text-red-700">、{freee.summary.errors} 件は勘定科目の対応付けが必要</span>}。</p>
          {freee.errors.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-red-700">{freee.errors.map((e) => <li key={e.key}>{e.key}：未対応科目 {e.unknownAccounts.join("、")}</li>)}</ul>}
          <p className="mt-2 text-xs text-neutral-500">※ 実際の送信には freee の勘定科目 ID の対応付けと認証が必要です（ここではプレビューのみ）。</p>
        </div>
      )}

      <div className="mb-6 rounded border border-neutral-200 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">試算表</h2>
          {ledger.balanced ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">貸借一致</span> : <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">不一致</span>}
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">勘定科目</th><th className="px-2 py-1 text-right">借方</th><th className="px-2 py-1 text-right">貸方</th><th className="px-2 py-1 text-right">残高</th></tr></thead>
          <tbody>
            {ledger.trialBalance.map((b) => (
              <tr key={b.account} className="border-b border-neutral-100">
                <td className="px-2 py-1.5"><button onClick={() => showLedger(b.account)} className="text-blue-600 hover:underline">{b.account}</button></td>
                <td className="px-2 py-1.5 text-right">{yen(b.debit)}</td>
                <td className="px-2 py-1.5 text-right">{yen(b.credit)}</td>
                <td className="px-2 py-1.5 text-right font-medium">{yen(b.balance)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-neutral-300 font-medium"><td className="px-2 py-1.5">合計</td><td className="px-2 py-1.5 text-right">¥{totalDebit.toLocaleString()}</td><td className="px-2 py-1.5 text-right">¥{totalCredit.toLocaleString()}</td><td></td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-sm font-medium">仕訳帳</h2>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">日付</th><th className="px-2 py-1">摘要</th><th className="px-2 py-1">勘定科目</th><th className="px-2 py-1 text-right">借方</th><th className="px-2 py-1 text-right">貸方</th></tr></thead>
        <tbody>
          {ledger.rows.map((r, i) => (
            <tr key={i} className="border-b border-neutral-100">
              <td className="px-2 py-1.5 text-xs text-neutral-500">{r.date}</td>
              <td className="px-2 py-1.5 text-xs">{r.description}</td>
              <td className="px-2 py-1.5">{r.account}</td>
              <td className="px-2 py-1.5 text-right">{yen(r.debit)}</td>
              <td className="px-2 py-1.5 text-right">{yen(r.credit)}</td>
            </tr>
          ))}
          {ledger.rows.length === 0 && <tr><td colSpan={5} className="px-2 py-4 text-center text-sm text-neutral-500">仕訳がありません。</td></tr>}
        </tbody>
      </table>

      {detail && (
        <div className="mt-6 rounded border border-neutral-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">勘定元帳：{detail.account}</h2>
            <button onClick={() => setDetail(null)} className="text-xs text-neutral-500 hover:underline">閉じる</button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">日付</th><th className="px-2 py-1">摘要</th><th className="px-2 py-1 text-right">借方</th><th className="px-2 py-1 text-right">貸方</th><th className="px-2 py-1 text-right">残高</th></tr></thead>
            <tbody>
              {detail.lines.map((l, i) => (
                <tr key={i} className="border-b border-neutral-100"><td className="px-2 py-1.5 text-xs">{l.date}</td><td className="px-2 py-1.5">{l.description}</td><td className="px-2 py-1.5 text-right">{l.debit ? `¥${l.debit.toLocaleString()}` : ""}</td><td className="px-2 py-1.5 text-right">{l.credit ? `¥${l.credit.toLocaleString()}` : ""}</td><td className="px-2 py-1.5 text-right font-medium">¥{l.balance.toLocaleString()}</td></tr>
              ))}
              {detail.lines.length === 0 && <tr><td colSpan={5} className="px-2 py-3 text-center text-neutral-500">この勘定の仕訳はありません。</td></tr>}
              <tr className="border-t-2 border-neutral-300 font-medium"><td className="px-2 py-1.5" colSpan={2}>合計 / 期末残高</td><td className="px-2 py-1.5 text-right">¥{detail.debitTotal.toLocaleString()}</td><td className="px-2 py-1.5 text-right">¥{detail.creditTotal.toLocaleString()}</td><td className="px-2 py-1.5 text-right">¥{detail.closingBalance.toLocaleString()}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded border border-neutral-200 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">手動仕訳（決算整理）の CSV 取込</h2>
          <button onClick={() => setImporting((v) => !v)} className="text-xs text-blue-600 hover:underline">{importing ? "閉じる" : "取込を開く"}</button>
        </div>
        {importing && (
          <div className="mb-3">
            <p className="mb-2 text-xs text-neutral-500">見出し「日付,摘要,勘定科目,借方,貸方,備考」。同じ日付＋摘要の行が 1 仕訳に束ねられ、貸借一致した仕訳のみ登録されます。取り込んだ仕訳は決算・元帳・仕訳帳に反映されます。</p>
            <input type="file" accept=".csv,text/csv" onChange={onJournalFile} className="mb-2 block text-sm" />
            <textarea value={jcsv} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJcsv(e.target.value)} rows={4} placeholder="日付,摘要,勘定科目,借方,貸方,備考&#10;2025-12-31,前払家賃,前払費用,50000,0,&#10;2025-12-31,前払家賃,支払家賃,0,50000," className="block w-full rounded border border-neutral-300 px-2 py-1 font-mono text-xs" />
            <div className="mt-2 flex items-center gap-3"><button onClick={runJournalImport} className="rounded bg-neutral-900 px-4 py-1.5 text-sm text-white">取り込む</button>{importMsg && <span className="text-xs text-neutral-600">{importMsg}</span>}</div>
          </div>
        )}
        {manual && manual.length > 0 && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">日付</th><th className="px-2 py-1">摘要</th><th className="px-2 py-1">勘定科目</th><th className="px-2 py-1 text-right">借方</th><th className="px-2 py-1 text-right">貸方</th></tr></thead>
            <tbody>{manual.map((r, i) => <tr key={i} className="border-b border-neutral-100"><td className="px-2 py-1.5 text-xs">{r.date}</td><td className="px-2 py-1.5">{r.description}</td><td className="px-2 py-1.5">{r.account}</td><td className="px-2 py-1.5 text-right">{r.debit ? `¥${r.debit.toLocaleString()}` : ""}</td><td className="px-2 py-1.5 text-right">{r.credit ? `¥${r.credit.toLocaleString()}` : ""}</td></tr>)}</tbody>
          </table>
        )}
        {manual && manual.length === 0 && !importing && <p className="text-xs text-neutral-500">登録された手動仕訳はありません。</p>}
      </div>

      <div className="mt-6 rounded border border-neutral-200 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">勘定科目マスタ（科目 → 区分）</h2>
          <button onClick={() => setShowAccounts((v) => !v)} className="text-xs text-blue-600 hover:underline">{showAccounts ? "閉じる" : "開く"}</button>
        </div>
        {showAccounts && (
          <>
            <p className="mb-2 text-xs text-neutral-500">ここで科目の区分（資産・負債・純資産・収益・費用）を登録すると、手動仕訳の任意科目も損益計算書・貸借対照表に集計されます。</p>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <label className="text-xs text-neutral-500">科目名<input value={acctForm.account} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAcctForm({ ...acctForm, account: e.target.value })} placeholder="例: 支払保険料" className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
              <label className="text-xs text-neutral-500">区分<select value={acctForm.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAcctForm({ ...acctForm, type: e.target.value })} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm"><option value="asset">資産</option><option value="liability">負債</option><option value="equity">純資産</option><option value="revenue">収益</option><option value="expense">費用</option></select></label>
              <button onClick={saveAccount} className="rounded bg-neutral-900 px-4 py-1.5 text-sm text-white">登録</button>
            </div>
            {accounts && (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">科目</th><th className="px-2 py-1">区分</th><th className="px-2 py-1"></th></tr></thead>
                <tbody>{accounts.map((a) => <tr key={a.account} className="border-b border-neutral-100"><td className="px-2 py-1.5">{a.account}</td><td className="px-2 py-1.5">{TYPE_LABEL[a.type] ?? a.type}</td><td className="px-2 py-1.5 text-right"><button onClick={() => removeAccount(a.account)} className="text-xs text-red-600 hover:underline">削除</button></td></tr>)}</tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
