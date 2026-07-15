# @demos/marketing-site — 公開サイト/LP の完成テンプレート

ページ定義(セクションブロックの並び)を渡すだけでマーケLPの骨格になる `MarketingPage`。
`admin-console` の公開サイト版です。

## 構成
| 役割 | 部品 |
| --- | --- |
| ヘッダー(ロゴ/ナビ/CTA) | `AppHeader` + `HeaderNav` + `HamburgerButton` |
| セクション本文 | `@platform/site` の `visibleBlocks`(hero/features/cta/faq…を出し分け) |
| フッター | `SiteFooter`(リンク列 + 著作権 + 法的リンク) |
| モバイルナビ | `Drawer` + `NavMenu` |
| SEO | `@platform/seo` の `buildMeta`(`visibility: "public"`)+ `renderMetaTags` |

## 使い方
```tsx
<MarketingPage
  page={{ slug: "home", title: "サービス名", blocks: [
    { id: "hero", type: "hero", data: { title: "見出し", subtitle: "説明", cta: "無料で始める" } },
    { id: "feat", type: "features", data: { title: "特徴" } },
    { id: "cta", type: "cta", data: { title: "今すぐ始めよう", cta: "登録" } },
  ] }}
  nav={[{ label: "機能", href: "/features" }, { label: "料金", href: "/pricing" }]}
  currentPath="/"
  logo={<Logo />}
  headerCta={<Button>お問い合わせ</Button>}
  companyName="Example Inc."
  seo={{ description: "サービスの説明", canonical: "https://example.com/" }}
/>
```

## 公開サイトなので SEO を適用
`buildMeta({ visibility: "public" })` で index 許可のメタを生成。`renderMetaTags` を `<head>` に展開し、
`@platform/site` の `redirects`(旧URL）・`announcement`(お知らせバー)や `@platform/blog`(記事)と組み合わせます。
社内ツールとは逆に、ここでは検索避けを**しない**のがポイントです。
