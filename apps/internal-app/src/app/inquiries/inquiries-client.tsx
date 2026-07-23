"use client";
/** お問い合わせ管理。届いた問い合わせの一覧・状況更新（未対応/対応中/完了）。 */
import * as React from "react";
import { Button, Select } from "@platform/ui";

interface Inquiry { id: string; name: string; email: string; category: string; subject: string; message: string; status: "new" | "in_progress" | "closed"; createdAt: string; }

const STATUS_LABEL: Record<string, string> = { new: "未対応", in_progress: "対応中", closed: "完了" };
const STATUS_CLS: Record<string, string> = { new: "bg-red-100 text-red-800", in_progress: "bg-yellow-100 text-yellow-800", closed: "bg-neutral-200 text-neutral-600" };
const fmt = (iso: string) => iso.replace("T", " ").slice(0, 16);

export interface InquiriesClientProps { fetchImpl?: typeof fetch; }

export function InquiriesClient({ fetchImpl }: InquiriesClientProps) {
  const [inquiries, setInquiries] = React.useState<Inquiry[]>([]);
  const [open, setOpen] = React.useState(0);
  const [filter, setFilter] = React.useState("");
  const [detail, setDetail] = React.useState<Inquiry | null>(null);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const qs = filter ? `?status=${filter}` : "";
    const res = await doFetch(`/api/inquiries${qs}`);
    if (res.ok) { const d = (await res.json()) as { inquiries: Inquiry[]; open: number }; setInquiries(d.inquiries); setOpen(d.open); }
  }, [doFetch, filter]);
  React.useEffect(() => { void reload(); }, [reload]);

  const setStatus = async (id: string, status: string) => {
    const res = await doFetch(`/api/inquiries/${id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (res.ok) { await reload(); if (detail && detail.id === id) setDetail({ ...detail, status: status as Inquiry["status"] }); }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold">お問い合わせ管理 {open > 0 && <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-sm text-white">{open}</span>}</h1>
        <Select value={filter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilter(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-sm" options={[{ label: "すべて", value: "" }, { label: "未対応", value: "new" }, { label: "対応中", value: "in_progress" }, { label: "完了", value: "closed" }]} />
      </div>
      <p className="mb-4 text-xs text-neutral-500">未対応 {open} 件。行をクリックで詳細、状況を切り替えられます。</p>

      <table className="w-full text-sm">
        <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">状況</th><th className="px-2 py-1">件名</th><th className="px-2 py-1">氏名</th><th className="px-2 py-1">カテゴリ</th><th className="px-2 py-1">受付</th></tr></thead>
        <tbody>
          {inquiries.map((q) => (
            <tr key={q.id} onClick={() => setDetail(q)} className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50">
              <td className="px-2 py-1.5"><span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_CLS[q.status]}`}>{STATUS_LABEL[q.status]}</span></td>
              <td className="px-2 py-1.5">{q.subject}</td>
              <td className="px-2 py-1.5">{q.name}</td>
              <td className="px-2 py-1.5 text-xs text-neutral-500">{q.category}</td>
              <td className="px-2 py-1.5 text-xs text-neutral-400">{fmt(q.createdAt)}</td>
            </tr>
          ))}
          {inquiries.length === 0 && <tr><td colSpan={5} className="px-2 py-6 text-center text-neutral-500">お問い合わせはありません。</td></tr>}
        </tbody>
      </table>

      {detail && (
        <div className="mt-6 rounded border border-neutral-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">{detail.subject}</h2>
            <Button onClick={() => setDetail(null)} className="text-xs text-neutral-500 hover:underline">閉じる</Button>
          </div>
          <p className="text-xs text-neutral-500">{detail.name}（{detail.email}） ／ {detail.category} ／ {fmt(detail.createdAt)}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-800">{detail.message}</p>
          <div className="mt-4 flex gap-2">
            {(["new", "in_progress", "closed"] as const).map((st) => (
              <Button key={st} onClick={() => setStatus(detail.id, st)} className={`rounded px-3 py-1 text-xs ${detail.status === st ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}>{STATUS_LABEL[st]}</Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
