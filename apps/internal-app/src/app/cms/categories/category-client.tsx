"use client";
/** カテゴリ・タグ管理。カテゴリは CRUD + 並べ替え、タグはリネーム/削除。 */
import * as React from "react";
import { Button, Input, SortableList } from "@platform/ui";

interface Category { id: string; name: string; slug: string; parentId?: string; order?: number; }
interface TagCount { tag: string; count: number; }

interface Draft { name: string; slug: string; parentId: string; }
const EMPTY: Draft = { name: "", slug: "", parentId: "" };

export interface CategoryClientProps { fetchImpl?: typeof fetch; }

export function CategoryClient({ fetchImpl }: CategoryClientProps) {
  const [cats, setCats] = React.useState<Category[]>([]);
  const [tags, setTags] = React.useState<TagCount[]>([]);
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const [rc, rt] = await Promise.all([doFetch("/api/cms/categories"), doFetch("/api/cms/tags")]);
    if (rc.ok) setCats(((await rc.json()) as { categories: Category[] }).categories);
    if (rt.ok) setTags(((await rt.json()) as { tags: TagCount[] }).tags);
  }, [doFetch]);

  React.useEffect(() => { void reload(); }, [reload]);

  const save = async () => {
    if (!editing) return;
    setError("");
    const payload = { name: editing.name, slug: editing.slug, ...(editing.parentId ? { parentId: editing.parentId } : {}) };
    const res = editId
      ? await doFetch(`/api/cms/categories/${editId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      : await doFetch("/api/cms/categories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { setError(((await res.json()) as { error?: string }).error ?? "保存に失敗しました"); return; }
    setEditing(null);
    setEditId(null);
    await reload();
  };

  const remove = async (id: string) => {
    const res = await doFetch(`/api/cms/categories/${id}`, { method: "DELETE" });
    if (res.ok) await reload();
  };

  const applyReorder = async (ordered: Category[]) => {
    setCats(ordered);
    const res = await doFetch("/api/cms/categories", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderedIds: ordered.map((c) => c.id) }) });
    if (res.ok) setCats(((await res.json()) as { categories: Category[] }).categories);
  };

  const renameTag = async (from: string) => {
    const to = (globalThis as unknown as { prompt: (m: string, d?: string) => string | null }).prompt(`「${from}」を何に変更しますか？`, from);
    if (!to || to === from) return;
    const res = await doFetch("/api/cms/tags", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "rename", from, to }) });
    if (res.ok) await reload();
  };

  const removeTag = async (tag: string) => {
    const res = await doFetch("/api/cms/tags", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "remove", from: tag }) });
    if (res.ok) await reload();
  };

  const set = (patch: Partial<Draft>) => setEditing((d) => (d ? { ...d, ...patch } : d));
  const nameOf = (id: string | undefined) => cats.find((c) => c.id === id)?.name ?? "";

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 p-6 md:grid-cols-2">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">カテゴリ</h1>
          <Button onClick={() => { setEditing({ ...EMPTY }); setEditId(null); setError(""); }} className="rounded bg-neutral-900 px-3 py-1 text-sm text-white">追加</Button>
        </div>
        {editing && (
          <div className="mb-4 flex flex-col gap-2 rounded border border-neutral-200 p-3">
            {error && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>}
            <Input value={editing.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ name: e.target.value })} placeholder="カテゴリ名" className="rounded border border-neutral-300 px-2 py-1 text-sm" />
            <Input value={editing.slug} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ slug: e.target.value })} placeholder="slug" className="rounded border border-neutral-300 px-2 py-1 text-sm" />
            <select value={editing.parentId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set({ parentId: e.target.value })} className="rounded border border-neutral-300 px-2 py-1 text-sm">
              <option value="">（親なし）</option>
              {cats.filter((c) => c.id !== editId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex gap-2">
              <Button onClick={save} className="rounded bg-neutral-900 px-3 py-1 text-sm text-white">保存</Button>
              <Button onClick={() => { setEditing(null); setEditId(null); }} className="rounded border border-neutral-300 px-3 py-1 text-sm">キャンセル</Button>
            </div>
          </div>
        )}
        <SortableList
          items={cats}
          getKey={(c) => c.id}
          onReorder={applyReorder}
          renderItem={(c) => (
            <div className="flex items-center justify-between rounded border border-neutral-200 px-3 py-2 text-sm">
              <span>
                {c.name} <span className="text-xs text-neutral-400">/{c.slug}</span>
                {c.parentId && <span className="ml-1 text-xs text-neutral-400">← {nameOf(c.parentId)}</span>}
              </span>
              <span className="flex gap-2">
                <Button onClick={() => { setEditing({ name: c.name, slug: c.slug, parentId: c.parentId ?? "" }); setEditId(c.id); setError(""); }} className="text-blue-600">編集</Button>
                <Button onClick={() => remove(c.id)} className="text-red-600">削除</Button>
              </span>
            </div>
          )}
        />
      </section>

      <section>
        <h1 className="mb-3 text-xl font-bold">タグ</h1>
        <p className="mb-2 text-xs text-neutral-500">タグは記事から集計されます。リネームすると全記事に反映されます。</p>
        <ul className="flex flex-col gap-1">
          {tags.map((t) => (
            <li key={t.tag} className="flex items-center justify-between rounded border border-neutral-200 px-3 py-2 text-sm">
              <span>#{t.tag} <span className="text-xs text-neutral-400">({t.count})</span></span>
              <span className="flex gap-2">
                <Button onClick={() => renameTag(t.tag)} className="text-blue-600">リネーム</Button>
                <Button onClick={() => removeTag(t.tag)} className="text-red-600">削除</Button>
              </span>
            </li>
          ))}
          {tags.length === 0 && <li className="text-sm text-neutral-400">タグはまだありません。</li>}
        </ul>
      </section>
    </div>
  );
}
