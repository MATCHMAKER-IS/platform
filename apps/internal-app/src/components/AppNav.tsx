"use client";
/**
 * 全画面共通のサイドナビ。
 *
 * 【なぜ横並びをやめたか】
 * 項目が 30 を超え、横一列では**画面幅に収まらず端が切れていた**。
 * さらに「どこに何があるか」の手がかりが無く、探すのに一覧を端から読む必要があった。
 * 縦に置いてカテゴリで束ねると、目的の区分だけを見ればよくなる。
 *
 * 【出し分け】
 * `/api/auth/me` の feature フラグと `/api/features` の可視設定で絞る。
 * **権限が無い項目は最初から出さない**(押してから 403 を見せない)。
 * @packageDocumentation
 */
import * as React from "react";
import { Button } from "@platform/ui";
import { AppUserMenu } from "./AppUserMenu";

/** ログイン中の利用者と、使える機能。 */
interface Me {
  user: { email: string; name: string; roles: string[]; department?: string } | null;
  features: Record<string, boolean>;
}

/** メニュー 1 件。 */
interface Item {
  label: string;
  href: string;
  /** 表示に必要な feature(省略時は常に表示)。 */
  feature?: string;
  /** 管理者だけに見せるか。 */
  adminOnly?: boolean;
}

/** カテゴリ 1 つ。 */
interface Group {
  name: string;
  items: Item[];
}

/**
 * メニューの構成。
 *
 * **業務の流れで並べる**(機能の実装順ではない)。
 * 毎日使うものを上に、設定・運用を下に置く。
 */
const GROUPS: Group[] = [
  {
    name: "日々の仕事",
    items: [
      { label: "ダッシュボード", href: "/dashboard" },
      { label: "タスク", href: "/tasks" },
      { label: "受信箱", href: "/mailbox" },
      { label: "通知", href: "/notifications" },
      { label: "チャット", href: "/chat" },
      { label: "掲示板", href: "/board" },
      { label: "ファイル", href: "/files" },
      { label: "FAQ", href: "/faq" },
      { label: "横断検索", href: "/search" },
    ],
  },
  {
    name: "申請・承認",
    items: [
      { label: "経費", href: "/expenses" },
      // 経費の下位画面(一覧からリンクが無く辿れなかった)
      { label: "経費の申請履歴", href: "/expenses/history" },
      { label: "経費レポート", href: "/expenses/report" },
      { label: "経費の取り込み", href: "/expenses/import", adminOnly: true },
      { label: "承認", href: "/approvals", feature: "decideApproval" },
      { label: "勤怠", href: "/attendance" },
      { label: "勤怠承認", href: "/attendance-approvals" },
      { label: "サイン", href: "/signatures" },
    ],
  },
  {
    name: "取引",
    items: [
      { label: "見積", href: "/quotes" },
      { label: "請求", href: "/invoices", feature: "viewInvoices" },
      { label: "発注", href: "/purchase-orders", feature: "viewPurchases" },
      { label: "支払", href: "/payables" },
      { label: "継続課金", href: "/recurring" },
      { label: "取引先", href: "/partners", feature: "managePartners" },
      { label: "契約", href: "/contracts" },
      { label: "問い合わせ", href: "/inquiries", feature: "handleInquiry" },
    ],
  },
  {
    name: "会計",
    items: [
      { label: "会計", href: "/accounting", feature: "viewAccounting" },
      { label: "決算", href: "/closing", feature: "viewAccounting" },
      { label: "資金繰り", href: "/cashflow" },
      { label: "口座残高", href: "/balance" },
      { label: "予算", href: "/budgets" },
      { label: "固定資産", href: "/assets" },
      { label: "給与", href: "/payroll" },
      { label: "源泉徴収", href: "/withholding" },
      { label: "レポート", href: "/reports" },
    ],
  },
  {
    name: "社内",
    items: [
      { label: "備品", href: "/equipment" },
      { label: "在庫", href: "/inventory" },
      { label: "予約", href: "/bookings" },
      { label: "部署", href: "/departments" },
      { label: "アンケート", href: "/surveys" },
      { label: "口コミ", href: "/reviews" },
      { label: "研修", href: "/learning" },
    ],
  },
  {
    name: "AI・分析",
    items: [
      { label: "AI アシスタント", href: "/ai" },
      { label: "画像生成", href: "/ai-image" },
      { label: "社内 RAG", href: "/rag" },
      { label: "分析", href: "/analytics", adminOnly: true },
      { label: "推移", href: "/trend" },
    ],
  },
  {
    name: "コンテンツ",
    items: [
      { label: "CMS", href: "/cms" },
      // **下位画面もナビに出す。**
      // CMS の画面内にリンクが無く、URL を直接叩かないと辿り着けなかった
      // (7 画面が孤立していた。2026-08)
      { label: "記事の履歴", href: "/cms/history" },
      { label: "公開申請", href: "/cms/publish-requests" },
      { label: "カテゴリ", href: "/cms/categories" },
      { label: "固定ページ", href: "/cms/pages" },
      { label: "お知らせ", href: "/cms/announcements" },
      { label: "メディア", href: "/cms/media" },
      { label: "CMS ダッシュボード", href: "/cms/dashboard" },
      { label: "問い合わせ窓口", href: "/contact" },
    ],
  },
  {
    name: "管理",
    items: [
      { label: "管理コンソール", href: "/admin/console", adminOnly: true },
      { label: "ユーザー・権限", href: "/admin/users", adminOnly: true },
      { label: "機能設定", href: "/admin/features", adminOnly: true },
      // **一般社員には出さない。** 全員の操作履歴が読める
      { label: "監査", href: "/audit", feature: "viewAudit" },
      { label: "APIキー", href: "/admin/service-accounts", adminOnly: true },
      { label: "秘密情報・フラグ", href: "/admin/platform", adminOnly: true },
      { label: "利用状況・Webhook", href: "/admin/insights", adminOnly: true },
      { label: "用語集", href: "/admin/glossary", adminOnly: true },
      // **個人情報を扱うので権限を絞る。** 誰でも「この人のデータ」を調べられてはいけない
      { label: "AI からの提案", href: "/admin/ai-approvals", adminOnly: true },
      { label: "AI の判断と実行履歴", href: "/admin/ai-governance", adminOnly: true },
      { label: "開示請求への対応", href: "/admin/disclosure", adminOnly: true },
      { label: "削除要求の判断", href: "/admin/erasure", adminOnly: true },
      { label: "テーマ", href: "/admin/themes", adminOnly: true },
    ],
  },
  {
    name: "運用",
    items: [
      { label: "運用ダッシュボード", href: "/admin/ops", adminOnly: true },
      { label: "システム状態", href: "/status", adminOnly: true },
      { label: "バックアップ", href: "/admin/backup", adminOnly: true },
      { label: "データ管理", href: "/admin/data", adminOnly: true },
      { label: "自動化", href: "/admin/automation", adminOnly: true },
      { label: "CSV 取込", href: "/import", adminOnly: true },
      { label: "RPA", href: "/rpa", adminOnly: true },
      { label: "開発者向け", href: "/developer", adminOnly: true },
      { label: "設定の確認", href: "/admin/env", adminOnly: true },
      // **「遅い」と言われたときに開く画面。**
      // 記録する仕組みを作っても、**見る手段が無ければ意味がありません**。
      { label: "性能", href: "/admin/performance", adminOnly: true },
      // **権限は付くばかりで外れません。** 半年に 1 回は見てください
      { label: "権限の棚卸し", href: "/admin/access-review", adminOnly: true },
      { label: "DB の中身", href: "/admin/db-viewer", adminOnly: true },
      { label: "メンテナンス", href: "/admin/maintenance", adminOnly: true },
    ],
  },
];

/**
 * href → 機能キー。`/api/features` の可視設定と突き合わせる。
 *
 * **ここに無い href は常に表示**(機能設定の対象外)。
 */
const HREF_TO_FEATURE: Record<string, string> = {
  "/dashboard": "dashboard", "/mailbox": "mailbox", "/invoices": "invoices",
  "/purchase-orders": "purchases", "/expenses": "expenses", "/approvals": "approvals",
  "/accounting": "accounting", "/closing": "closing", "/partners": "partners",
  "/inquiries": "inquiries", "/audit": "audit", "/surveys": "surveys",
  "/reviews": "reviews", "/signatures": "signatures",
};

/** {@link AppNav} の props。 */
export interface AppNavProps { fetchImpl?: typeof fetch }

/** サイドナビ。 */
export function AppNav({ fetchImpl }: AppNavProps) {
  const [me, setMe] = React.useState<Me | null>(null);
  const [accessible, setAccessible] = React.useState<string[] | null>(null);
  const [path, setPath] = React.useState("");
  // **たたんだ状態を覚える。** 毎回開き直すのは煩わしい
  // **既定はたたんだ状態。**
  // 項目が 50 を超えるので、全部開くと一覧が長すぎて目的地を探せない。
  // **今いるカテゴリだけ開く**(そこから隣の画面へ移ることが多い)。
  // `null` は「まだ現在地が分からない」= 何も開かない
  const [openGroup, setOpenGroup] = React.useState<string | null>(null);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  React.useEffect(() => {
    void (async () => {
      try {
        const r = await doFetch("/api/auth/me");
        if (r.ok) { setMe((await r.json()) as Me); return; }
        // **401 ならログイン画面へ送る。**
        // 無効化された利用者はここで弾かれる(セッションは有効なままなので、
        // これが無いと退職者が最大 8 時間そのまま操作できる)。
        // 既にログイン画面なら送らない(繰り返しになる)
        if (r.status === 401 && window.location.pathname !== "/login") {
          // **戻す理由を持たせる。**
          // 黙って戻すと「ログインしたのに戻される」だけになり、
          // 締め出されたのか設定の食い違いなのかが分からない
          const body = (await r.json().catch(() => ({}))) as { reason?: string };
          const to = new URL("/login", window.location.origin);
          if (body.reason !== undefined) to.searchParams.set("reason", body.reason);
          window.location.href = to.toString();
        }
      } catch { /* 通信不能。画面はそのまま */ }
    })();
  }, [doFetch]);

  React.useEffect(() => {
    void (async () => {
      try {
        const r = await doFetch("/api/features");
        if (r.ok) setAccessible(((await r.json()) as { accessible: string[] }).accessible);
      } catch { /* noop */ }
    })();
  }, [doFetch]);

  // 現在地の強調に使う(サーバ側では window が無いので effect で取る)
  React.useEffect(() => {
    const p = window.location.pathname;
    setPath(p);
    // 現在地を含むカテゴリを開く。**前方一致で見る**
    // (`/board/thread_general` から `/board` を当てるため)
    const hit = GROUPS.find((g) => g.items.some(
      (m) => p === m.href || p.startsWith(`${m.href}/`)));
    if (hit !== undefined) setOpenGroup(hit.name);
  }, []);

  if (me === null || me.user === null) return null;
  const user = me.user;
  const isAdmin = user.roles.includes("admin");

  /** 機能設定で非表示にされていないか。 */
  const featureAllowed = (href: string): boolean => {
    const key = HREF_TO_FEATURE[href];
    return key === undefined || accessible === null || accessible.includes(key);
  };

  /** その項目を出してよいか。 */
  const visible = (item: Item): boolean => {
    if (item.adminOnly === true && !isAdmin) return false;
    if (item.feature !== undefined && me.features[item.feature] !== true) return false;
    return featureAllowed(item.href);
  };

  const groups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter(visible) }))
    // **中身が無いカテゴリは見出しごと消す**(空の見出しは迷いを生む)
    .filter((g) => g.items.length > 0);

  // **高さは親(h-screen)いっぱい。** `h-full` にして親に合わせる。
  // `h-screen` を直接指定すると、親が画面より低いときにはみ出す。
  // 中身は「見出し / 一覧(伸びる) / 利用者」の 3 段で、
  // **一覧だけが縮む**ので利用者の欄は常に下に見える
  return (
    <nav className="flex h-full w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-3">
        <a href="/overview" className="font-semibold text-[var(--color-fg)]">社内アプリ</a>
      </div>

      {/* **端まで来ても親へスクロールを渡さない**(overscroll-contain)。
          これが無いと、一覧の下端で回したときに本文が動く */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {groups.map((g) => (
          <section key={g.name} className="mb-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between px-2 text-xs font-semibold text-[var(--color-muted)]"
              // **一度に開くのは 1 つ。** 複数開くと結局長くなる
              onClick={() => setOpenGroup((cur) => (cur === g.name ? null : g.name))}
              aria-expanded={openGroup === g.name}
            >
              {g.name}
              <span aria-hidden="true">{openGroup === g.name ? "▾" : "▸"}</span>
            </Button>
            {openGroup === g.name && (
              <ul>
                {g.items.map((m) => {
                  const current = path === m.href;
                  return (
                    <li key={m.href}>
                      <a
                        href={m.href}
                        aria-current={current ? "page" : undefined}
                        className={`block rounded px-3 py-1.5 text-sm hover:bg-[var(--color-subtle)] ${
                          current
                            ? "bg-[var(--color-subtle)] font-semibold text-[var(--color-fg)]"
                            : "text-[var(--color-muted)]"
                        }`}
                      >
                        {m.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>

      {/* **縮ませない。** 一覧が長くても押し出されない */}
      <div className="shrink-0">
        <AppUserMenu user={user} />
      </div>
    </nav>
  );
}
