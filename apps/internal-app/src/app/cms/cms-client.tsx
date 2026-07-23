"use client";
/**
 * CMS 管理画面。記事の一覧・作成・編集・公開/下書き・削除。
 * @packageDocumentation
 */
import * as React from "react";
import { Button, Checkbox, Input, Select, Textarea } from "@platform/ui";
import { nl2br, linkify } from "@platform/html";
import { filterPosts, diffRevisions } from "@platform/cms";

interface Post {
  slug: string;
  title: string;
  categoryId?: string;
  excerpt?: string;
  eyecatch?: string;
  body: string;
  tags: string[];
  status: "draft" | "published";
  publishedAt?: string;
  updatedAt: string;
  effectiveStatus?: "draft" | "scheduled" | "published";
}

type Tab = "all" | "published" | "scheduled" | "draft";
const TAB_LABELS: Record<Tab, string> = { all: "すべて", published: "公開中", scheduled: "予約", draft: "下書き" };

/** 予約公開までの残り時間を人間可読にする。 */
function untilLabel(publishedAt: string | undefined): string {
  if (!publishedAt) return "";
  const ms = new Date(publishedAt).getTime() - Date.now();
  if (ms <= 0) return "まもなく公開";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `公開まで ${days}日${hours}時間`;
  if (hours > 0) return `公開まで ${hours}時間${mins}分`;
  return `公開まで ${mins}分`;
}

interface Draft {
  slug: string;
  title: string;
  categoryId: string;
  excerpt: string;
  eyecatch: string;
  body: string;
  tags: string;
  status: "draft" | "published";
  publishedAt: string;
}

const EMPTY: Draft = { slug: "", title: "", categoryId: "", excerpt: "", eyecatch: "", body: "", tags: "", status: "draft", publishedAt: "" };

function toDraft(p: Post): Draft {
  return { slug: p.slug, title: p.title, categoryId: p.categoryId ?? "", excerpt: p.excerpt ?? "", eyecatch: p.eyecatch ?? "", body: p.body, tags: p.tags.join(", "), status: p.status, publishedAt: p.publishedAt ? p.publishedAt.slice(0, 16) : "" };
}

export interface CmsClientProps {
  fetchImpl?: typeof fetch;
  /** 公開権限があるか（無ければ「公開申請」表示）。 */
  canPublish?: boolean;
}

export function CmsClient({ fetchImpl, canPublish = true }: CmsClientProps) {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const [originalSlug, setOriginalSlug] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [preview, setPreview] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("all");
  const [query, setQuery] = React.useState("");
  const [filterCategory, setFilterCategory] = React.useState("");
  const [filterTag, setFilterTag] = React.useState("");
  const [showLibrary, setShowLibrary] = React.useState(false);
  const [library, setLibrary] = React.useState<{ key: string; url: string; name: string }[]>([]);
  const [categoryOptions, setCategoryOptions] = React.useState<{ id: string; name: string }[]>([]);
  const [revisions, setRevisions] = React.useState<{ id: string; version: number; savedBy: string; savedAt: string; title: string; body: string; status: string; categoryId?: string }[]>([]);
  const [diff, setDiff] = React.useState<{ version: number; result: ReturnType<typeof diffRevisions> } | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const [autoSaved, setAutoSaved] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const [res, rc] = await Promise.all([doFetch("/api/cms/posts"), doFetch("/api/cms/categories")]);
    if (res.ok) setPosts(((await res.json()) as { posts: Post[] }).posts);
    if (rc.ok) setCategoryOptions(((await rc.json()) as { categories: { id: string; name: string }[] }).categories);
  }, [doFetch]);

  React.useEffect(() => { void reload(); }, [reload]);

  const startNew = () => { setEditing({ ...EMPTY }); setOriginalSlug(null); setError(""); };
  const startEdit = (p: Post) => { setEditing(toDraft(p)); setOriginalSlug(p.slug); setError(""); };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setError("");
    const payload = {
      slug: editing.slug,
      title: editing.title,
      body: editing.body,
      status: editing.status,
      ...(editing.categoryId ? { categoryId: editing.categoryId } : {}),
      ...(editing.excerpt ? { excerpt: editing.excerpt } : {}),
      ...(editing.eyecatch ? { eyecatch: editing.eyecatch } : {}),
      tags: editing.tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0),
      ...(editing.publishedAt ? { publishedAt: new Date(editing.publishedAt).toISOString() } : {}),
    };
    const res = originalSlug
      ? await doFetch(`/api/cms/posts/${originalSlug}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      : await doFetch("/api/cms/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (!res.ok) { setError(((await res.json()) as { error?: string }).error ?? "保存に失敗しました"); return; }
    setEditing(null);
    setOriginalSlug(null);
    setPreview(false);
    await reload();
  };

  const remove = async (slug: string) => {
    const res = await doFetch(`/api/cms/posts/${slug}`, { method: "DELETE" });
    if (res.ok) await reload();
  };

  const set = (patch: Partial<Draft>) => setEditing((d) => (d ? { ...d, ...patch } : d));

  const allTagsFromPosts = React.useMemo(() => Array.from(new Set(posts.flatMap((p) => p.tags))).sort(), [posts]);
  const visiblePosts = filterPosts(posts, {
    ...(query.trim() ? { query } : {}),
    ...(filterCategory ? { categoryId: filterCategory } : {}),
    ...(filterTag ? { tag: filterTag } : {}),
    ...(tab !== "all" ? { status: tab } : {}),
  });

  const uploadEyecatch = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await doFetch("/api/cms/upload", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) {
      const data = (await res.json()) as { files: { url: string }[] };
      if (data.files[0]) set({ eyecatch: data.files[0].url });
    }
  };

  const openLibrary = async () => {
    const res = await doFetch("/api/cms/media");
    if (res.ok) { setLibrary(((await res.json()) as { media: { key: string; url: string; name: string }[] }).media); setShowLibrary(true); }
  };

  const openHistory = async () => {
    if (!originalSlug) return;
    const res = await doFetch(`/api/cms/posts/${originalSlug}/revisions`);
    if (res.ok) { setRevisions(((await res.json()) as { revisions: typeof revisions }).revisions); setShowHistory(true); }
  };

  const restoreRevision = async (id: string) => {
    if (!originalSlug) return;
    const res = await doFetch(`/api/cms/posts/${originalSlug}/revisions/${id}/restore`, { method: "POST" });
    if (res.ok) {
      const post = (await res.json()) as Post;
      setEditing(toDraft(post));
      setShowHistory(false);
      await reload();
    }
  };

  const showDiff = (r: { version: number; title: string; body: string; status: string; categoryId?: string }) => {
    if (!editing) return;
    setDiff({ version: r.version, result: diffRevisions(
      { title: r.title, body: r.body, status: r.status, ...(r.categoryId ? { categoryId: r.categoryId } : {}) },
      { title: editing.title, body: editing.body, status: editing.status, ...(editing.categoryId ? { categoryId: editing.categoryId } : {}) }) });
  };

  // 自動保存(下書きとして、編集内容が変わってから2秒後)
  const autosaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (!editing || originalSlug === null) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      const payload = { slug: editing.slug, title: editing.title, categoryId: editing.categoryId || undefined, excerpt: editing.excerpt || undefined, eyecatch: editing.eyecatch || undefined, body: editing.body, tags: editing.tags, status: "draft" as const };
      const res = await doFetch(`/api/cms/posts/${originalSlug}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) { setAutoSaved(new Date().toLocaleTimeString()); }
    }, 2000);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [editing?.title, editing?.body, editing?.excerpt, originalSlug]);

  const bodyHtml = editing ? nl2br(linkify(editing.body)) : "";

  const openPreview = async () => {
    if (!originalSlug) return;
    const res = await doFetch(`/api/cms/preview-url?slug=${encodeURIComponent(originalSlug)}`);
    if (res.ok) {
      const { url } = (await res.json()) as { url: string };
      (globalThis as unknown as { open: (u: string, t?: string) => void }).open(url, "_blank");
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">記事管理</h1>
        <Button onClick={startNew} className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm text-white">新規記事</Button>
      </div>

      {editing ? (
        <div className="flex flex-col gap-3 rounded border border-[var(--color-border)] p-4">
          <h2 className="text-lg font-semibold">{originalSlug ? "記事を編集" : "新規記事"}</h2>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <label className="text-sm">slug<Input value={editing.slug} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ slug: e.target.value })} placeholder="my-post" className="mt-1 w-full rounded border border-[var(--color-border)] px-2 py-1" /></label>
          <label className="text-sm">タイトル<Input value={editing.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ title: e.target.value })} className="mt-1 w-full rounded border border-[var(--color-border)] px-2 py-1" /></label>
          <label className="text-sm">カテゴリ
            <Select value={editing.categoryId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set({ categoryId: e.target.value })} className="mt-1 block w-full rounded border border-[var(--color-border)] px-2 py-1" options={[{ label: "（未分類）", value: "" }, ...categoryOptions.map((c) => ({ label: c.name, value: String(c.id) }))]} />
          </label>
          <label className="text-sm">アイキャッチ URL<Input value={editing.eyecatch} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ eyecatch: e.target.value })} className="mt-1 w-full rounded border border-[var(--color-border)] px-2 py-1" /></label>
          <label className="text-sm">抜粋<Input value={editing.excerpt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ excerpt: e.target.value })} className="mt-1 w-full rounded border border-[var(--color-border)] px-2 py-1" /></label>
          <label className="text-sm">本文<Textarea value={editing.body} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set({ body: e.target.value })} rows={8} className="mt-1 w-full rounded border border-[var(--color-border)] px-2 py-1" /></label>
          <label className="text-sm">タグ（カンマ区切り）<Input value={editing.tags} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ tags: e.target.value })} className="mt-1 w-full rounded border border-[var(--color-border)] px-2 py-1" /></label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox  checked={editing.status === "published"} onCheckedChange={(v) => set({ status: !!v ? "published" : "draft" })} />
            {canPublish ? "公開する" : "公開を申請する（承認後に公開）"}
          </label>
          <label className="text-sm">公開日時（未来にすると予約公開）
            <Input type="datetime-local" value={editing.publishedAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ publishedAt: e.target.value })} className="mt-1 block rounded border border-[var(--color-border)] px-2 py-1" />
          </label>
          <div className="flex items-center gap-2 text-sm">
            <label className="cursor-pointer rounded border border-[var(--color-border)] px-3 py-1">
              {uploading ? "アップロード中…" : "アイキャッチ画像を選択"}
              <input type="file" accept="image/*" className="hidden" onChange={(e: React.ChangeEvent<HTMLInputElement & { files: FileList }>) => { const f = e.target.files[0]; if (f) void uploadEyecatch(f); }} />
            </label>
            <Button type="button" onClick={openLibrary} className="rounded border border-[var(--color-border)] px-3 py-1">ライブラリから選択</Button>
            {editing.eyecatch && <img src={editing.eyecatch} alt="" className="h-10 w-16 rounded object-cover" />}
            <Button type="button" onClick={() => setPreview((v) => !v)} className="ml-auto rounded border border-[var(--color-border)] px-3 py-1">{preview ? "編集に戻る" : "プレビュー"}</Button>
          </div>
          {showLibrary && (
            <div className="rounded border border-[var(--color-border)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">メディアライブラリ</span>
                <Button type="button" onClick={() => setShowLibrary(false)} className="text-sm text-[var(--color-muted)]">閉じる</Button>
              </div>
              {library.length === 0 ? (
                <p className="text-xs text-[var(--color-muted)]">画像がありません。</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {library.map((m) => (
                    <Button key={m.key} type="button" onClick={() => { set({ eyecatch: m.url }); setShowLibrary(false); }} className="overflow-hidden rounded border border-[var(--color-border)] hover:border-[var(--color-primary)]">
                      <img src={m.url} alt={m.name} className="h-16 w-full object-cover" loading="lazy" />
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
          {preview && (
            <div className="rounded border border-[var(--color-border)] bg-[var(--color-muted-bg,#fafafa)] p-4">
              {editing.eyecatch && <img src={editing.eyecatch} alt="" className="mb-3 h-40 w-full rounded object-cover" />}
              <h3 className="mb-1 text-xl font-bold">{editing.title || "(無題)"}</h3>
              <div className="leading-relaxed [&_a]:text-blue-600 [&_a]:underline" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "保存中…" : "保存"}</Button>
            <Button onClick={() => { setEditing(null); setOriginalSlug(null); }} className="rounded border border-[var(--color-border)] px-4 py-2 text-sm">キャンセル</Button>
            {originalSlug && <Button onClick={openHistory} className="rounded border border-[var(--color-border)] px-4 py-2 text-sm">変更履歴</Button>}
            {originalSlug && <Button onClick={openPreview} className="rounded border border-[var(--color-border)] px-4 py-2 text-sm">公開サイトでプレビュー ↗</Button>}
            {autoSaved && <span className="ml-auto self-center text-xs text-[var(--color-muted)]">自動保存しました（{autoSaved}）</span>}
          </div>
          {showHistory && (
            <div className="rounded border border-[var(--color-border)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">変更履歴</span>
                <Button type="button" onClick={() => setShowHistory(false)} className="text-sm text-[var(--color-muted)]">閉じる</Button>
              </div>
              {revisions.length === 0 ? (
                <p className="text-xs text-[var(--color-muted)]">履歴がありません。</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {revisions.map((r) => (
                    <li key={r.id} className="flex items-center justify-between rounded border border-[var(--color-border)] px-2 py-1 text-sm">
                      <span>v{r.version}・{r.title} <span className="text-xs text-[var(--color-muted)]">{r.savedAt.slice(0, 16).replace("T", " ")}・{r.savedBy}</span></span>
                      <span className="flex gap-3">
                        <Button type="button" onClick={() => showDiff(r)} className="text-blue-600 hover:underline">現在と比較</Button>
                        <Button type="button" onClick={() => restoreRevision(r.id)} className="text-blue-600 hover:underline">この版に戻す</Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {diff && (
                <div className="mt-3 rounded border border-[var(--color-border)] p-2 text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">v{diff.version} → 現在の差分</span>
                    <Button type="button" onClick={() => setDiff(null)} className="text-xs text-[var(--color-muted)]">閉じる</Button>
                  </div>
                  {diff.result.titleChanged && <p className="text-xs">タイトル: <span className="text-red-600 line-through">{diff.result.titleFrom}</span> → <span className="text-green-700">{diff.result.titleTo}</span></p>}
                  {diff.result.statusChanged && <p className="text-xs">状態: {diff.result.statusFrom} → {diff.result.statusTo}</p>}
                  {diff.result.categoryChanged && <p className="text-xs">カテゴリ: {diff.result.categoryFrom ?? "（なし）"} → {diff.result.categoryTo ?? "（なし）"}</p>}
                  {diff.result.bodyChanged ? (
                    <pre className="mt-1 overflow-x-auto rounded bg-[var(--color-surface)] p-2 text-xs leading-relaxed">
                      {diff.result.body.map((l, i) => (
                        <div key={i} className={l.type === "add" ? "bg-green-50 text-green-800" : l.type === "del" ? "bg-red-50 text-red-700 line-through" : "text-[var(--color-muted)]"}>
                          {l.type === "add" ? "+ " : l.type === "del" ? "- " : "  "}{l.text || " "}
                        </div>
                      ))}
                    </pre>
                  ) : <p className="text-xs text-[var(--color-muted)]">本文の変更はありません。</p>}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <Button key={t} onClick={() => setTab(t)} className={tab === t ? "rounded bg-[var(--color-primary)] px-3 py-1 text-sm text-white" : "rounded border border-[var(--color-border)] px-3 py-1 text-sm"}>
              {TAB_LABELS[t]}
            </Button>
          ))}
          <Input value={query} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)} placeholder="タイトル・本文・タグで検索" className="ml-auto w-56 rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
          <Select value={filterCategory} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterCategory(e.target.value)} className="rounded border border-[var(--color-border)] px-2 py-1 text-sm" options={[{ label: "全カテゴリ", value: "" }, ...categoryOptions.map((c) => ({ label: c.name, value: String(c.id) }))]} />
          <Select value={filterTag} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterTag(e.target.value)} className="rounded border border-[var(--color-border)] px-2 py-1 text-sm" options={[{ label: "全タグ", value: "" }, ...allTagsFromPosts.map((t) => ({ label: t, value: String(t) }))]} />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
              <th className="px-2 py-1">タイトル</th>
              <th className="px-2 py-1">slug</th>
              <th className="px-2 py-1">状態</th>
              <th className="px-2 py-1">更新</th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {visiblePosts.map((p) => {
              const eff = p.effectiveStatus ?? p.status;
              const badge = eff === "published" ? "rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700" : eff === "scheduled" ? "rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700" : "rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600";
              const label = eff === "published" ? "公開中" : eff === "scheduled" ? "予約" : "下書き";
              return (
                <tr key={p.slug} className="border-b border-[var(--color-border)]">
                  <td className="px-2 py-2 font-medium">{p.title}</td>
                  <td className="px-2 py-2 text-[var(--color-muted)]">{p.slug}</td>
                  <td className="px-2 py-2">
                    <span className={badge}>{label}</span>
                    {eff === "scheduled" && <span className="ml-2 text-xs text-amber-600">{untilLabel(p.publishedAt)}</span>}
                  </td>
                  <td className="px-2 py-2 text-xs text-[var(--color-muted)]">{p.updatedAt.slice(0, 10)}</td>
                  <td className="px-2 py-2 text-right">
                    <Button onClick={() => startEdit(p)} className="mr-2 text-blue-600 hover:underline">編集</Button>
                    <Button onClick={() => remove(p.slug)} className="text-red-600 hover:underline">削除</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </>
      )}
    </div>
  );
}
