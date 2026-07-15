"use client";
/** 全画面共通のグローバルナビ。/api/auth/me の feature フラグでメニューを出し分ける。 */
import * as React from "react";

interface Me { user: { email: string; name: string; roles: string[] } | null; features: Record<string, boolean>; }

// [ラベル, リンク, 表示に必要な feature（省略時は常に表示）]
const MENU: { label: string; href: string; feature?: string }[] = [
  { label: "ダッシュボード", href: "/dashboard" },
  { label: "タスク", href: "/tasks" },
  { label: "契約", href: "/contracts" },
  { label: "FAQ", href: "/faq" },
  { label: "受信箱", href: "/mailbox" },
  { label: "請求", href: "/invoices", feature: "viewInvoices" },
  { label: "発注", href: "/purchase-orders", feature: "viewPurchases" },
  { label: "経費", href: "/expenses" },
  { label: "承認", href: "/approvals", feature: "decideApproval" },
  { label: "会計", href: "/accounting", feature: "viewAccounting" },
  { label: "決算", href: "/closing", feature: "viewAccounting" },
  { label: "取引先", href: "/partners", feature: "managePartners" },
  { label: "問い合わせ", href: "/inquiries", feature: "handleInquiry" },
  { label: "監査", href: "/audit" },
  { label: "アンケート", href: "/surveys" },
  { label: "口コミ", href: "/reviews" },
  { label: "サイン", href: "/signatures" },
];

export interface AppNavProps { fetchImpl?: typeof fetch; }

export function AppNav({ fetchImpl }: AppNavProps) {
  const [me, setMe] = React.useState<Me | null>(null);
  const [accessible, setAccessible] = React.useState<string[] | null>(null);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  React.useEffect(() => { (async () => { try { const r = await doFetch("/api/auth/me"); if (r.ok) setMe((await r.json()) as Me); } catch { /* 未ログインなど */ } })(); }, [doFetch]);
  React.useEffect(() => { (async () => { try { const r = await doFetch("/api/features"); if (r.ok) setAccessible(((await r.json()) as { accessible: string[] }).accessible); } catch { /* noop */ } })(); }, [doFetch]);

  if (!me || !me.user) return null;
  const isAdmin = me.user.roles.includes("admin");
  const HREF_TO_FEATURE: Record<string, string> = { "/dashboard": "dashboard", "/mailbox": "mailbox", "/invoices": "invoices", "/purchase-orders": "purchases", "/expenses": "expenses", "/approvals": "approvals", "/accounting": "accounting", "/closing": "closing", "/partners": "partners", "/inquiries": "inquiries", "/audit": "audit", "/surveys": "surveys", "/reviews": "reviews", "/signatures": "signatures" };
  const featureAllowed = (href: string) => { const key = HREF_TO_FEATURE[href]; return !key || accessible === null || accessible.includes(key); };
  const visible = MENU.filter((m) => (!m.feature || me.features[m.feature]) && featureAllowed(m.href));

  return (
    <nav className="sticky top-0 z-30 flex items-center gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-3 py-2 text-sm">
      <span className="mr-2 font-semibold text-neutral-900">社内アプリ</span>
      {visible.map((m) => <a key={m.href} href={m.href} className="whitespace-nowrap rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100">{m.label}</a>)}
      {isAdmin && <a href="/admin/ops" className="whitespace-nowrap rounded px-2 py-1 font-medium text-neutral-900 hover:bg-neutral-100" title="運用ダッシュボード(障害時はまずここ)">運用</a>}
      {isAdmin && <a href="/admin/console" className="whitespace-nowrap rounded px-2 py-1 font-medium text-neutral-900 hover:bg-neutral-100">管理</a>}
      {isAdmin && <a href="/admin/users" className="whitespace-nowrap rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100">ユーザー</a>}
      {isAdmin && <a href="/admin/features" className="whitespace-nowrap rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100">機能設定</a>}
      {isAdmin && <a href="/admin/insights" className="whitespace-nowrap rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100">分析</a>}
      {isAdmin && <a href="/admin/service-accounts" className="whitespace-nowrap rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100">APIキー</a>}
      {isAdmin && <a href="/admin/platform" className="whitespace-nowrap rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100">秘密/フラグ</a>}
      <a href="/search" className="whitespace-nowrap rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100">検索</a>
      {isAdmin && <a href="/reports" className="whitespace-nowrap rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100">レポート</a>}
      {isAdmin && <a href="/import" className="whitespace-nowrap rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100">取込</a>}
      {isAdmin && <a href="/developer" className="whitespace-nowrap rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100">開発者</a>}
      {isAdmin && <a href="/admin/backup" className="whitespace-nowrap rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100">バックアップ</a>}
      {isAdmin && <a href="/admin/data" className="whitespace-nowrap rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100">データ管理</a>}
      {isAdmin && <a href="/admin/automation" className="whitespace-nowrap rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100">自動化</a>}
      {isAdmin && <a href="/status" className="whitespace-nowrap rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100">状態</a>}
      <span className="ml-auto whitespace-nowrap text-xs text-neutral-400">{me.user.name}</span>
    </nav>
  );
}
