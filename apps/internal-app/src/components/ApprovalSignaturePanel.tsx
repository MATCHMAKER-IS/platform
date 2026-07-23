"use client";
/** 承認へのサイン。承認（docType/docNumber）に手書き署名を付与し、既存署名と状況を表示する。 */
import * as React from "react";
import { Button } from "@platform/ui";
import { SignaturePad } from "./SignaturePad";

interface Sig { id: string; signer: string; image: string; signedAt: string; }

export function ApprovalSignaturePanel({ docType, docNumber, required = false, fetchImpl }: { docType: string; docNumber: string; required?: boolean; fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [sigs, setSigs] = React.useState<Sig[]>([]);
  const [open, setOpen] = React.useState(false);

  const reload = React.useCallback(async () => {
    const r = await doFetch(`/api/approvals/${encodeURIComponent(docType)}/${encodeURIComponent(docNumber)}/signatures?required=${required ? "1" : "0"}`);
    if (r.ok) setSigs(((await r.json()) as { signatures: Sig[] }).signatures);
  }, [doFetch, docType, docNumber, required]);
  React.useEffect(() => { void reload(); }, [reload]);

  const onSave = async (image: string) => {
    const r = await doFetch(`/api/approvals/${encodeURIComponent(docType)}/${encodeURIComponent(docNumber)}/signatures`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image }) });
    if (r.ok) { setOpen(false); await reload(); }
  };

  return (
    <div className="mt-2 border-t border-neutral-100 pt-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-neutral-500">サイン: {sigs.length > 0 ? `${sigs.length}件（${sigs.map((s) => s.signer).join("、")}）` : "なし"}</span>
        {required && sigs.length === 0 && <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">署名が必要です</span>}
        <Button type="button" onClick={() => setOpen((v) => !v)} className="text-blue-600 hover:underline">{open ? "閉じる" : "サインする"}</Button>
      </div>
      {open && <div className="mt-2"><SignaturePad onSave={onSave} width={320} height={120} /></div>}
      {sigs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {sigs.map((s) => <div key={s.id} className="rounded border border-neutral-200 p-1"><img src={s.image} alt={`${s.signer}の署名`} className="h-12 w-auto" /><p className="text-center text-xs text-neutral-400">{s.signer}</p></div>)}
        </div>
      )}
    </div>
  );
}
