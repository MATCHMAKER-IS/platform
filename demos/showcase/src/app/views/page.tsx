"use client";
/** カード/リスト/ブロック表示・ページネーション・トップに戻る のデモ。 */
import { useMemo, useState } from "react";
import {
  DataView, Card, CardHeader, CardTitle, CardDescription, CardContent,
  ListItem, Block, Badge, Pagination, SimplePagination, BackToTop, Icon,
} from "@platform/ui";

interface Product { id: number; name: string; category: string; price: number; }
const ALL: Product[] = Array.from({ length: 43 }, (_v, i) => ({
  id: i + 1,
  name: `商品 ${String(i + 1).padStart(2, "0")}`,
  category: ["文具", "食品", "家電", "書籍"][i % 4]!,
  price: (i + 1) * 320,
}));
const PAGE_SIZE = 8;

export default function Page() {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(ALL.length / PAGE_SIZE);
  const items = useMemo(() => ALL.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [page]);

  return (
    <main style={{ maxWidth: 900, margin: "3rem auto", padding: "0 1rem", minHeight: "200vh" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>表示切替 / ページネーション</h1>
      <p style={{ color: "var(--color-muted)", marginBottom: "1.5rem" }}>
        右上のトグルでカード / リスト / ブロック表示を切り替え。下にスクロールすると「トップに戻る」が出ます。
      </p>

      <DataView
        items={items}
        getKey={(p) => p.id}
        defaultView="card"
        toolbarStart={`全 ${ALL.length} 件中 ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, ALL.length)} 件`}
        renderItem={(p, mode) =>
          mode === "list" ? (
            <ListItem
              leading={<Icon name="Package" className="h-5 w-5 text-[var(--color-primary)]" />}
              title={p.name}
              description={p.category}
              trailing={`¥${p.price.toLocaleString()}`}
            />
          ) : mode === "block" ? (
            <Block icon={<Icon name="Package" className="h-6 w-6" />} label={p.name} onSelect={() => {}} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
                <CardDescription><Badge variant="secondary">{p.category}</Badge></CardDescription>
              </CardHeader>
              <CardContent style={{ fontSize: "1.1rem", fontWeight: 700 }}>¥{p.price.toLocaleString()}</CardContent>
            </Card>
          )
        }
      />

      <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "center" }}>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
      <div style={{ marginTop: "1rem", maxWidth: 320, marginInline: "auto" }}>
        <SimplePagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <p style={{ marginTop: "4rem", color: "var(--color-muted)" }}>↓ さらにスクロールしてみてください(トップに戻るボタンが表示されます)</p>
      <p style={{ marginTop: "60vh" }}><a href="/">← 戻る</a></p>

      <BackToTop />
    </main>
  );
}
