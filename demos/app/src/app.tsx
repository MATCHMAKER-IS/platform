"use client";
/**
 * 統合サンプルアプリ。ログイン → ダッシュボード → 一覧 → フォーム → アップロードを 1 つに束ね、
 * RBAC で画面/メニュー/ボタンを出し分ける。基盤 UI とデモ部品の総合的な組み合わせ例。
 * @packageDocumentation
 */
import * as React from "react";
import {
  ThemeProvider, AppShell, AppHeader, HamburgerButton, NavMenu, UserMenu, ThemeToggle,
  PageHeader, SiteFooter, Breadcrumb, NotificationBell, Toaster, Button,
  filterNavByPermission, useNotifications, type NavItem,
} from "@platform/ui";
import { breadcrumbFromPath } from "@platform/site";
import { LoginCard } from "@platform/ui";
import { RoleProvider, useCan, Can, policy } from "./rbac.js";
import { DataConsole, type BookingRow } from "../../data-console/src/data-console.js";
import { SignupForm } from "../../validated-form/src/signup-form.js";
import { UploadPanel } from "../../upload/src/upload-panel.js";

/** ナビ定義(権限タグ付き)。 */
const NAV: NavItem[] = [
  { label: "ダッシュボード", href: "/" },
  { label: "予約一覧", href: "/bookings", permission: "booking:read", badge: 3 },
  { label: "会員登録", href: "/signup", permission: "booking:write" },
  { label: "資料アップロード", href: "/upload", permission: "report:read" },
];

type Route = "/" | "/bookings" | "/signup" | "/upload";

/** アプリのシェル(認証後)。 */
function Shell({ roles, onLogout, rows }: { roles: string[]; onLogout: () => void; rows: BookingRow[] }) {
  const [route, setRoute] = React.useState<Route>("/");
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const isAllowed = useCan();
  const visibleNav = filterNavByPermission(NAV, isAllowed);
  const crumbs = breadcrumbFromPath(route, { labels: { bookings: "予約", signup: "会員登録", upload: "アップロード" } });
  const notify = useNotifications({ initial: [{ id: "1", title: "新しい予約が入りました", createdAt: new Date().toISOString() }] });

  const go = (item: NavItem) => { setRoute(item.href as Route); setMobileOpen(false); };

  return (
    <div className="flex min-h-screen flex-col">
      <AppShell
        header={
          <AppHeader
            sticky
            leading={<HamburgerButton open={mobileOpen} onClick={() => setMobileOpen(true)} className="md:hidden" />}
            logo={<span className="font-semibold">Platform Demo</span>}
            actions={
              <>
                <NotificationBell notifications={notify.notifications} onMarkAllRead={notify.markAllRead} onNotificationClick={(n) => notify.markRead(n.id)} />
                <ThemeToggle theme="system" onThemeChange={() => {}} />
                <UserMenu name="デモユーザー" detail={roles.join(", ")} items={[{ label: "ログアウト", onSelect: onLogout, danger: true }]} />
              </>
            }
          />
        }
        sidebar={<NavMenu items={visibleNav} currentPath={route} onNavigate={go} />}
      >
        <PageHeader
          title={visibleNav.find((n) => n.href === route)?.label ?? "ダッシュボード"}
          breadcrumb={<Breadcrumb items={crumbs} />}
          actions={<Can permission="booking:write"><Button onClick={() => setRoute("/signup")}>新規登録</Button></Can>}
        />

        {route === "/" && <p className="text-sm text-[var(--color-muted)]">ようこそ。左のメニューから操作を選んでください（権限に応じて項目が変わります）。</p>}
        {route === "/bookings" && <Can permission="booking:read" fallback={<Denied />}><DataConsole rows={rows} /></Can>}
        {route === "/signup" && <Can permission="booking:write" fallback={<Denied />}><SignupForm onSubmit={async () => {}} /></Can>}
        {route === "/upload" && <Can permission="report:read" fallback={<Denied />}><UploadPanel url="/api/upload" /></Can>}
      </AppShell>

      <SiteFooter copyrightName="Platform Demo" />
    </div>
  );
}

function Denied() {
  return <p className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-6 text-sm text-red-700">この画面を表示する権限がありません。</p>;
}

/** アプリのエントリ。未ログインならログイン画面、ログイン後はロール切替付きシェル。 */
export function App({ rows }: { rows: BookingRow[] }) {
  const [roles, setRoles] = React.useState<string[] | null>(null);

  if (roles == null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <LoginCard title="サンプルアプリ" subtitle="ロールを選んでログイン" providers={["google", "zoho"]} onSelectProvider={() => setRoles(["staff"])} />
          {/* デモ用のロール切替 */}
          <div className="flex gap-2 text-sm">
            <Button variant="secondary" size="sm" onClick={() => setRoles(["staff"])}>staff で入る</Button>
            <Button variant="secondary" size="sm" onClick={() => setRoles(["manager"])}>manager で入る</Button>
            <Button variant="secondary" size="sm" onClick={() => setRoles(["admin"])}>admin で入る</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <RoleProvider roles={roles}>
        <Shell roles={roles} onLogout={() => setRoles(null)} rows={rows} />
      </RoleProvider>
      <Toaster />
    </ThemeProvider>
  );
}
