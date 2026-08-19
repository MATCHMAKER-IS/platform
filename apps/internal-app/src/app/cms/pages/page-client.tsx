"use client";
/** 固定ページ管理。BlockEditor でブロックを編集し、下書き/公開を切り替える。 */
import * as React from "react";
import { BlockEditor, Button, Checkbox, Input, type EditableBlock, PageShell, ConfirmDialog } from "@platform/ui";

interface ManagedPage {
  slug: string;
  title: string;
  blocks: EditableBlock[];
  status: "draft" | "published";
  updatedAt: string;
}

interface Draft {
  slug: string;
  title: string;
  blocks: EditableBlock[];
  status: "draft" | "published";
}

const EMPTY: Draft = { slug: "", title: "", blocks: [], status: "draft" };

export interface PageClientProps {
  fetchImpl?: typeof fetch;
}

export function PageClient({ fetchImpl }: PageClientProps) {
  const [pages, setPages] = React.useState<ManagedPage[]>([]);
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const [originalSlug, setOriginalSlug] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch("/api/cms/pages");
    if (res.ok) setPages(((await res.json()) as { pages: ManagedPage[] }).pages);
  }, [doFetch]);

  React.useEffect(() => { void reload(); }, [reload]);

  const startNew = () => { setEditing({ ...EMPTY, blocks: [] }); setOriginalSlug(null); setError(""); };
  const startEdit = (p: ManagedPage) => { setEditing({ slug: p.slug, title: p.title, blocks: p.blocks, status: p.status }); setOriginalSlug(p.slug); setError(""); };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setError("");
    const payload = { slug: editing.slug, title: editing.title, blocks: editing.blocks, status: editing.status };
    const res = originalSlug !== null
      ? await doFetch(`/api/cms/pages/${originalSlug}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      : await doFetch("/api/cms/pages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (!res.ok) { setError(((await res.json()) as { error?: string }).error ?? "保存に失敗しました"); return; }
    setEditing(null);
    setOriginalSlug(null);
    await reload();
  };

  // **削除の前に確認を挟む。**
  // 公開ページは**押した瞬間に消え**、**外から見られなくなります**——
  // **検索エンジンにも SNS にも載っている**ことがあり、
  // **消したことに気づくのは、見に来た人**です。
  const [removingSlug, setRemovingSlug] = React.useState<string | null>(null);

  const remove = async (slug: string) => {
    const res = await doFetch(`/api/cms/pages/${slug}`, { method: "DELETE" });
    if (res.ok) await reload();
  };

  const set = (patch: Partial<Draft>) => setEditing((d) => (d ? { ...d, ...patch } : d));

  return (
    <PageShell title="固定ページ管理" width="wide">
    <Button onClick={startNew} className="rounded px-4 py-2 text-sm text-white">新規ページ</Button>

      {editing ? (
        <div className="flex flex-col gap-3 rounded border border-[var(--color-border)] p-4">
          <h2 className="text-lg font-semibold">{originalSlug !== null ? "ページを編集" : "新規ページ"}</h2>
          {error && <p className="rounded bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}
          <label className="text-sm">slug（空欄でトップページ）<Input value={editing.slug} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ slug: e.target.value })} placeholder="about" className="mt-1 w-full rounded border border-[var(--color-border)] px-2 py-1" /></label>
          <label className="text-sm">タイトル<Input value={editing.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ title: e.target.value })} className="mt-1 w-full rounded border border-[var(--color-border)] px-2 py-1" /></label>
          <div>
            <p className="mb-2 text-sm font-medium">本文ブロック</p>
            <BlockEditor blocks={editing.blocks} onChange={(blocks: EditableBlock[]) => set({ blocks })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox  checked={editing.status === "published"} onCheckedChange={(v) => set({ status: !!v ? "published" : "draft" })} />
            公開する
          </label>
          <div className="flex gap-2">
      <Button onClick={save} disabled={saving} className="rounded px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "保存中…" : "保存"}</Button>
            <Button onClick={() => { setEditing(null); setOriginalSlug(null); }} variant="secondary" className="rounded px-4 py-2 text-sm">キャンセル</Button>
          </div>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
              <th className="px-2 py-1">タイトル</th>
              <th className="px-2 py-1">slug</th>
              <th className="px-2 py-1">状態</th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.slug} className="border-b border-[var(--color-border)]">
                <td className="px-2 py-2 font-medium">{p.title}</td>
                <td className="px-2 py-2 text-[var(--color-muted)]">{p.slug === "" ? "(トップ)" : p.slug}</td>
                <td className="px-2 py-2"><span className={p.status === "published" ? "rounded bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] px-1.5 py-0.5 text-xs text-[var(--color-success)]" : "rounded bg-[var(--color-subtle)] px-1.5 py-0.5 text-xs text-[var(--color-muted)]"}>{p.status === "published" ? "公開中" : "下書き"}</span></td>
                <td className="px-2 py-2 text-right">
         <Button onClick={() => startEdit(p)} variant="secondary" className="mr-2 hover:underline">編集</Button>
                  <Button onClick={() => setRemovingSlug(p.slug)} variant="danger" className="hover:underline">削除</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* **削除の前に確認。** 公開ページは**押した瞬間に消え**、
          **外から見られなくなります**——**気づくのは見に来た人**です。 */}
      <ConfirmDialog
        open={removingSlug !== null}
        onOpenChange={(o) => { if (!o) setRemovingSlug(null); }}
        title="このページを削除します"
        description="公開中のページは、削除すると外から見られなくなります。元に戻せません。"
        confirmText="削除する"
        destructive
        onConfirm={() => {
          const slug = removingSlug;
          setRemovingSlug(null);
          if (slug !== null) void remove(slug);
        }}
      />
    </PageShell>
  );
}
