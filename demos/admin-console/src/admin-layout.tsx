"use client";
/**
 * 管理画面レイアウトの完成テンプレート(基盤UIの組み合わせ)。
 * ThemeProvider + AppShell + AppHeader(ロゴ/ナビ/テーマ切替/ユーザーメニュー)+ NavMenu(サイド/モバイル)
 * + PageHeader(自動パンくず)+ SiteFooter を 1 つに束ねた、そのまま使える骨格。
 * @packageDocumentation
 */
import * as React from "react";
import {
  ThemeProvider, useTheme,
  AppShell, AppHeader, HeaderNav, HamburgerButton, NavMenu, UserMenu, ThemeToggle,
  PageHeader, SiteFooter, Breadcrumb, Drawer, DrawerContent,
  type NavItem,
} from "@platform/ui";
import { breadcrumbFromPath } from "@platform/site";

/** ThemeProvider の状態に接続したテーマ切替ボタン。 */
function ConnectedThemeToggle() {
  const { theme, resolved, setTheme } = useTheme();
  return <ThemeToggle theme={theme} resolved={resolved} onThemeChange={setTheme} />;
}

/** {@link AdminLayout} の props。 */
export interface AdminLayoutProps {
  /** 現在のパス(アクティブ表示・パンくず生成)。 */
  currentPath: string;
  /** ナビ項目(ヘッダー横並び + サイド/モバイル縦型で共用)。 */
  nav: NavItem[];
  /** ロゴ/ブランド。 */
  logo: React.ReactNode;
  /** ログインユーザー。 */
  user: { name: string; detail?: string };
  /** ログアウト。 */
  onLogout: () => void;
  /** ページタイトル。 */
  title: React.ReactNode;
  /** ページ説明。 */
  description?: React.ReactNode;
  /** ページ右上のアクション。 */
  actions?: React.ReactNode;
  /** パンくずのラベル上書き。 */
  breadcrumbLabels?: Record<string, string>;
  /** 会社名(フッター著作権)。 */
  companyName: string;
  children: React.ReactNode;
}

/** 管理画面の共通レイアウト。ページ側は title / children を渡すだけ。 */
export function AdminLayout({
  currentPath, nav, logo, user, onLogout, title, description, actions, breadcrumbLabels, companyName, children,
}: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const crumbs = breadcrumbFromPath(currentPath, { labels: breadcrumbLabels });

  const userMenu = (
    <UserMenu
      name={user.name}
      detail={user.detail}
      items={[
        { label: "プロフィール", href: "/profile" },
        { label: "設定", href: "/settings" },
        { label: "ログアウト", onSelect: onLogout, danger: true, separated: true },
      ]}
    />
  );

  return (
    <ThemeProvider>
      <div className="flex min-h-screen flex-col">
        <AppShell
          header={
            <AppHeader
              sticky
              leading={<HamburgerButton open={mobileOpen} onClick={() => setMobileOpen(true)} className="md:hidden" />}
              logo={logo}
              nav={<HeaderNav items={nav} currentPath={currentPath} />}
              actions={<><ConnectedThemeToggle />{userMenu}</>}
            />
          }
          sidebar={<NavMenu items={nav} currentPath={currentPath} />}
        >
          <PageHeader title={title} description={description} actions={actions} breadcrumb={<Breadcrumb items={crumbs} />} />
          {children}
        </AppShell>

        <SiteFooter
          copyrightName={companyName}
          legalLinks={[{ label: "利用規約", href: "/terms" }, { label: "プライバシー", href: "/privacy" }]}
        />

        {/* モバイル: ハンバーガーで開くドロワーに同じ NavMenu を入れる */}
        <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
          <DrawerContent side="left">
            <NavMenu items={nav} currentPath={currentPath} onNavigate={() => setMobileOpen(false)} />
          </DrawerContent>
        </Drawer>
      </div>
    </ThemeProvider>
  );
}
