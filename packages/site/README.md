# @platform/site

公式サイト・LP のための基盤処理。ページ構成(セクションブロック)・ナビゲーションメニュー・
URL リダイレクト・お知らせバー。SEO は `@platform/seo`、フォームは `@platform/form`、
AB テストは `@platform/flags`、多言語は `@platform/i18n` と組み合わせます。すべて純ロジック。

## ページ構成(セクションブロック)
LP を「ブロックの並び」として構造化します。管理画面でのドラッグ並べ替え・期間限定表示に対応。
```ts
import { visibleBlocks, reorderBlocks, moveBlockUp } from "@platform/site";

const page = { slug: "home", title: "トップ", blocks: [
  { id: "h", type: "hero", data: { title: "ようこそ", cta: "無料で始める" } },
  { id: "feat", type: "features", data: { items: [...] } },
  { id: "sale", type: "cta", data: {}, visibleFrom: "2025-08-01", visibleUntil: "2025-08-31" },  // 期間限定
]};

const blocks = visibleBlocks(page);        // 公開中(非表示/期間外を除外)を順番どおり
const next = moveBlockUp(page.blocks, "feat");  // 管理画面の並べ替え
```
各ブロックの描画(見た目)はアプリ側で `block.type` に応じて出し分けます。

## ナビゲーションメニュー
```ts
import { activeTrail, breadcrumbFromMenu, isActive } from "@platform/site";
const menu = [{ label: "製品", href: "/products", children: [{ label: "製品A", href: "/products/a" }] }];
isActive(menuItem, currentPath);           // ハイライト判定(前方一致)
activeTrail(menu, "/products/a");           // [製品, 製品A] 経路(親カテゴリのハイライト)
breadcrumbFromMenu(menu, currentPath);      // パンくず
```

## URL リダイレクト(サイトリニューアル)
```ts
import { resolveRedirect } from "@platform/site";
const rules = [{ from: "/old", to: "/new" }, { from: "/blog/*", to: "/articles/:splat", status: 301 }];
resolveRedirect(rules, "/blog/2025/hello");   // { to: "/articles/2025/hello", status: 301 }
```
完全一致と末尾ワイルドカード(`:splat`)、連鎖解決(A→B→C)に対応。

## お知らせバー
```ts
import { activeAnnouncements, topAnnouncement } from "@platform/site";
const anns = [{ id: "sale", message: "夏セール開催中", endAt: "2025-08-31", level: "sale", paths: ["/products"] }];
activeAnnouncements(anns, currentPath, { now, dismissedIds });   // 期間・対象ページ・閉じた状態で絞り込み
topAnnouncement(anns, currentPath);                              // 最優先の1件(sale > warning > info)
```

## パンくずの自動生成
メニュー定義から作る `breadcrumbFromMenu` に加え、URL パスから直接作る `breadcrumbFromPath` があります。
```ts
import { breadcrumbFromPath } from "@platform/site";
breadcrumbFromPath("/products/a");   // [ホーム, Products, A] 各セグメントを累積リンクに
breadcrumbFromPath("/products/a", { labels: { products: "製品", "/products/a": "製品A" } });  // ラベル指定
```
生成した項目は `@platform/ui` の `Breadcrumb`(`items={...}`)にそのまま渡せます。

