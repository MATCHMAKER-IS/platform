"use client";
import * as React from "react";
import { UsesPackages } from "../../components/uses-packages";
import { NotionDemo } from "./notion-demo";

export default function Page() {
  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>Notion 連携</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        データベースの照会・ページの作成・本文の取得。ページ送りを自動でたどる <code>queryAll</code> を用意しています。
      </p>
      <NotionDemo />
      <UsesPackages
        packages={["notion"]}
        imports={{ notion: ["createNotionClient"] }}
        snippet={`const notion = createNotionClient(env.NOTION_TOKEN);

// **全件が要るなら queryAll**。queryDatabase は 1 回分（最大 100 件）しか返さない
const pages = await notion.queryAll({ databaseId });

// テストやデモでは fetch を差し替える（実 API を叩かずにロジックを確かめる）
const notionMock = createNotionClient("dummy", fakeFetch);`}
      />
    </main>
  );
}
