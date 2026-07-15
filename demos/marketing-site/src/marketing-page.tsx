"use client";
/**
 * 公開サイト/LP の完成テンプレート(基盤の組み合わせ)。
 * AppHeader(ロゴ/ナビ/CTA)+ セクションブロック(@platform/site の visibleBlocks)+ SiteFooter を束ね、
 * ページ定義(ブロックの並び)を渡すだけでマーケLPの骨格になる。公開ページなので SEO を適用する。
 * @packageDocumentation
 */
import * as React from "react";
import {
  AppHeader, HeaderNav, HamburgerButton, SiteFooter, Button, Drawer, DrawerContent, NavMenu,
  type NavItem,
} from "@platform/ui";
import { visibleBlocks, type Page, type PageBlock } from "@platform/site";
import { buildMeta, renderMetaTags } from "@platform/seo";

/** ブロックを描画する(type ごとに出し分け)。実際の見た目はプロジェクトのデザインに合わせる。 */
function BlockView({ block }: { block: PageBlock }) {
  const d = block.data as Record<string, string>;
  switch (block.type) {
    case "hero":
      return (
        <section className="bg-[var(--color-bg)] px-4 py-20 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold text-[var(--color-fg)]">{d.title}</h1>
          {d.subtitle != null && <p className="mx-auto mt-4 max-w-xl text-lg text-[var(--color-muted)]">{d.subtitle}</p>}
          {d.cta != null && <div className="mt-8"><Button size="lg">{d.cta}</Button></div>}
        </section>
      );
    case "features":
      return <section className="px-4 py-16"><h2 className="text-center text-2xl font-semibold text-[var(--color-fg)]">{d.title ?? "特徴"}</h2></section>;
    case "cta":
      return (
        <section className="bg-[var(--color-primary)] px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold text-[var(--color-primary-fg)]">{d.title}</h2>
          {d.cta != null && <div className="mt-6"><Button variant="secondary" size="lg">{d.cta}</Button></div>}
        </section>
      );
    case "faq":
      return <section className="px-4 py-16"><h2 className="text-center text-2xl font-semibold text-[var(--color-fg)]">{d.title ?? "よくある質問"}</h2></section>;
    default:
      return <section className="px-4 py-12"><h2 className="text-xl font-semibold text-[var(--color-fg)]">{d.title ?? block.type}</h2></section>;
  }
}

/** {@link MarketingPage} の props。 */
export interface MarketingPageProps {
  /** ページ定義(セクションブロックの並び)。 */
  page: Page;
  /** グローバルナビ。 */
  nav: NavItem[];
  currentPath: string;
  logo: React.ReactNode;
  /** ヘッダー右の CTA(「お問い合わせ」など)。 */
  headerCta?: React.ReactNode;
  /** フッターのリンク列。 */
  footerGroups?: { title: string; links: { label: string; href: string; external?: boolean }[] }[];
  companyName: string;
  /** SEO 用。 */
  seo: { description: string; canonical: string };
}

/** 公開サイト/LP の共通テンプレート。 */
export function MarketingPage({ page, nav, currentPath, logo, headerCta, footerGroups, companyName, seo }: MarketingPageProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const blocks = visibleBlocks(page);
  // 公開ページなので visibility: "public" で index 許可のメタを出す
  const meta = buildMeta({ title: page.title, description: seo.description, canonical: seo.canonical, visibility: "public" });

  return (
    <div className="flex min-h-screen flex-col">
      {/* <head> に入れる: renderMetaTags(meta) を Next.js の metadata / head で使う */}
      <AppHeader
        sticky
        leading={<HamburgerButton open={mobileOpen} onClick={() => setMobileOpen(true)} className="md:hidden" />}
        logo={logo}
        nav={<HeaderNav items={nav} currentPath={currentPath} />}
        actions={headerCta}
      />

      <main className="flex-1">
        {blocks.map((block) => <BlockView key={block.id} block={block} />)}
      </main>

      <SiteFooter
        groups={footerGroups}
        copyrightName={companyName}
        legalLinks={[{ label: "利用規約", href: "/terms" }, { label: "プライバシーポリシー", href: "/privacy" }]}
      />

      <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
        <DrawerContent side="left">
          <NavMenu items={nav} currentPath={currentPath} onNavigate={() => setMobileOpen(false)} />
        </DrawerContent>
      </Drawer>

      {/* meta.tags を <head> に展開する例(実際はフレームワークの head 機構で) */}
      <div hidden data-meta={renderMetaTags(meta).length} />
    </div>
  );
}
