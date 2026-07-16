"use client";
/** サインページ。対象（書類ID）に手書きサインを保存し、既存サインを一覧表示。 */
import * as React from "react";
import { SignaturePad } from "../../components/SignaturePad";

interface Signature { id: string; signer: string; image: string; signedAt: string; }

export function SignaturesClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [docId, setDocId] = React.useState("DOC-001");
  const [signatures, setSignatures] = React.useState<Signature[]>([]);
  const [msg, setMsg] = React.useState("");

  const reload = React.useCallback(async () => {
    const r = await doFetch(`/api/signatures?subjectType=document&subjectId=${encodeURIComponent(docId)}`);
    if (r.ok) setSignatures(((await r.json()) as { signatures: Signature[] }).signatures);
  }, [doFetch, docId]);
  React.useEffect(() => { void reload(); }, [reload]);

  const onSave = async (image: string) => {
    setMsg("");
    const r = await doFetch("/api/signatures", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subjectType: "document", subjectId: docId, image }) });
    if (r.ok) { setMsg("サインを保存しました"); await reload(); }
    else setMsg(((await r.json()) as { error?: string }).error ?? "保存に失敗しました");
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-bold">サイン</h1>
      <label className="text-xs text-neutral-500">対象書類ID<input value={docId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDocId(e.target.value)} className="mt-0.5 mb-4 block w-48 rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
      <p className="mb-2 text-sm text-neutral-600">下の枠内にサインしてください:</p>
      <SignaturePad onSave={onSave} />
      {msg && <p className="mt-2 text-sm text-neutral-600">{msg}</p>}
      <h2 className="mt-6 mb-2 text-sm font-medium">この書類のサイン（{signatures.length}件）</h2>
      <div className="flex flex-wrap gap-3">
        {signatures.map((s) => (
          <div key={s.id} className="rounded border border-neutral-200 p-2">
            <img src={s.image} alt={`${s.signer} の署名`} className="h-20 w-auto" />
            <p className="mt-1 text-xs text-neutral-500">{s.signer}</p>
            <p className="text-xs text-neutral-400">{s.signedAt.replace("T", " ").slice(0, 16)}</p>
          </div>
        ))}
        {signatures.length === 0 && <p className="text-sm text-neutral-500">まだサインはありません。</p>}
      </div>
    </div>
  );
}
