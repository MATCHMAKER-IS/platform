"use client";
/** お知らせ管理。メッセージ・表示期間・対象パス・CTA を編集する。 */
import * as React from "react";
import { Button, Input, Select } from "@platform/ui";

interface Announcement {
  id: string;
  message: string;
  startAt?: string;
  endAt?: string;
  paths?: string[];
  ctaLabel?: string;
  ctaHref?: string;
  level?: string;
}

interface Draft {
  message: string;
  startAt: string;
  endAt: string;
  paths: string;
  ctaLabel: string;
  ctaHref: string;
  level: string;
}

const EMPTY: Draft = { message: "", startAt: "", endAt: "", paths: "", ctaLabel: "", ctaHref: "", level: "info" };

function toDraft(a: Announcement): Draft {
  return { message: a.message, startAt: a.startAt ? a.startAt.slice(0, 16) : "", endAt: a.endAt ? a.endAt.slice(0, 16) : "", paths: (a.paths ?? []).join(", "), ctaLabel: a.ctaLabel ?? "", ctaHref: a.ctaHref ?? "", level: a.level ?? "info" };
}

export interface AnnouncementClientProps {
  fetchImpl?: typeof fetch;
}

export function AnnouncementClient({ fetchImpl }: AnnouncementClientProps) {
  const [items, setItems] = React.useState<Announcement[]>([]);
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch("/api/cms/announcements");
    if (res.ok) setItems(((await res.json()) as { announcements: Announcement[] }).announcements);
  }, [doFetch]);

  React.useEffect(() => { void reload(); }, [reload]);

  const save = async () => {
    if (!editing) return;
    setError("");
    const payload = {
      message: editing.message,
      ...(editing.startAt ? { startAt: new Date(editing.startAt).toISOString() } : {}),
      ...(editing.endAt ? { endAt: new Date(editing.endAt).toISOString() } : {}),
      ...(editing.paths.trim() ? { paths: editing.paths.split(",").map((p) => p.trim()).filter((p) => p.length > 0) } : {}),
      ...(editing.ctaLabel ? { ctaLabel: editing.ctaLabel } : {}),
      ...(editing.ctaHref ? { ctaHref: editing.ctaHref } : {}),
      ...(editing.level ? { level: editing.level } : {}),
    };
    const res = editId
      ? await doFetch(`/api/cms/announcements/${editId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      : await doFetch("/api/cms/announcements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { setError(((await res.json()) as { error?: string }).error ?? "保存に失敗しました"); return; }
    setEditing(null);
    setEditId(null);
    await reload();
  };

  const remove = async (id: string) => {
    const res = await doFetch(`/api/cms/announcements/${id}`, { method: "DELETE" });
    if (res.ok) await reload();
  };

  const set = (patch: Partial<Draft>) => setEditing((d) => (d ? { ...d, ...patch } : d));

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">お知らせ管理</h1>
        <Button onClick={() => { setEditing({ ...EMPTY }); setEditId(null); setError(""); }} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">新規お知らせ</Button>
      </div>

      {editing && (
        <div className="mb-6 flex flex-col gap-3 rounded border border-neutral-200 p-4">
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <label className="text-sm">メッセージ<Input value={editing.message} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ message: e.target.value })} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1" /></label>
          <div className="flex gap-3">
            <label className="flex-1 text-sm">開始<Input type="datetime-local" value={editing.startAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ startAt: e.target.value })} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1" /></label>
            <label className="flex-1 text-sm">終了<Input type="datetime-local" value={editing.endAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ endAt: e.target.value })} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1" /></label>
          </div>
          <label className="text-sm">対象パス（カンマ区切り・前方一致・空欄で全ページ）<Input value={editing.paths} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ paths: e.target.value })} placeholder="/blog, /news" className="mt-1 w-full rounded border border-neutral-300 px-2 py-1" /></label>
          <div className="flex gap-3">
            <label className="flex-1 text-sm">CTA ラベル<Input value={editing.ctaLabel} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ ctaLabel: e.target.value })} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1" /></label>
            <label className="flex-1 text-sm">CTA リンク<Input value={editing.ctaHref} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ ctaHref: e.target.value })} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1" /></label>
            <label className="text-sm">重要度
              <Select value={editing.level} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set({ level: e.target.value })} className="mt-1 block rounded border border-neutral-300 px-2 py-1" options={[{ label: "info", value: "info" }, { label: "warning", value: "warning" }, { label: "critical", value: "critical" }]} />
            </label>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">保存</Button>
            <Button onClick={() => { setEditing(null); setEditId(null); }} className="rounded border border-neutral-300 px-4 py-2 text-sm">キャンセル</Button>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {items.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded border border-neutral-200 px-3 py-2">
            <div>
              <p className="font-medium">{a.message}</p>
              <p className="text-xs text-neutral-500">
                {a.level && <span className="mr-2">[{a.level}]</span>}
                {a.startAt ? a.startAt.slice(0, 10) : "—"} 〜 {a.endAt ? a.endAt.slice(0, 10) : "—"}
                {a.paths && a.paths.length > 0 && <span className="ml-2">対象: {a.paths.join(", ")}</span>}
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              <Button onClick={() => { setEditing(toDraft(a)); setEditId(a.id); setError(""); }} className="text-blue-600 hover:underline">編集</Button>
              <Button onClick={() => remove(a.id)} className="text-red-600 hover:underline">削除</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
