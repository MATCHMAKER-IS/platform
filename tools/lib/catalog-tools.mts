/**
 * 基盤カタログ MCP のツール定義。serveStdio から切り離して検証できるようにする。
 * @packageDocumentation
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { textResult, errorResult, type McpToolDef } from "@platform/mcp";
import { loadCatalog, searchCatalog, describePackage, listByCategory, loadDemos, searchDemos, type PackageEntry, type DemoEntry } from "./catalog.mjs";

export interface CatalogToolDeps {
  /** リポジトリルート。 */
  root: string;
  /** 事前に読み込んだカタログ(省略時は root から読む)。 */
  catalog?: PackageEntry[];
  /** 事前に読み込んだデモ一覧(省略時は root から読む)。 */
  demos?: DemoEntry[];
}

/** 基盤カタログのツール 3 種を組み立てる。 */
export function buildCatalogTools(deps: CatalogToolDeps): McpToolDef[] {
  const catalog = deps.catalog ?? loadCatalog({ root: deps.root });
  const demos = deps.demos ?? loadDemos({ root: deps.root });
  return [
    {
      name: "search_platform",
      description:
        "社内基盤(@platform/*)からキーワードで機能を探す。新機能を作る前に必ず呼び、既存部品の再発明を避ける。" +
        "例: 'csv 出力' / 'メール送信' / 'deriveTheme' / '権限判定'。日本語・英語どちらでも検索できる。",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "探したい機能のキーワード(日本語可)" },
          limit: { type: "number", description: "最大件数(既定 10)" },
        },
        required: ["query"],
      },
      handler: (args) => {
        const query = String(args.query ?? "");
        const limit = Number(args.limit ?? 10);
        if (!query.trim()) return errorResult("query を指定してください");
        const hits = searchCatalog(catalog, query, Math.min(Math.max(Number.isFinite(limit) ? limit : 10, 1), 30));
        if (hits.length === 0) {
          return textResult(`「${query}」に該当する基盤機能は見つかりませんでした。別の言い回しでも試してください(見つからなければ新規作成の検討へ)。`);
        }
        const lines = hits.map((h) => `- **${h.full}**（${h.category}）${h.api ? ` → \`${h.api}\`` : ""}\n  ${h.summary}\n  一致: ${h.matched}`);
        return textResult(`「${query}」の検索結果 ${hits.length} 件:\n\n${lines.join("\n")}\n\n詳細は describe_package を使ってください。`);
      },
    },
    {
      name: "describe_package",
      description: "基盤パッケージ 1 件の詳細(README 全文 + 公開 API 一覧)を返す。使い方を知りたいときに呼ぶ。",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string", description: "パッケージ名(例: theme / @platform/theme)" } },
        required: ["name"],
      },
      handler: (args) => {
        const name = String(args.name ?? "");
        if (!name.trim()) return errorResult("name を指定してください");
        const doc = describePackage(catalog, deps.root, name);
        if (!doc) return errorResult(`パッケージが見つかりません: ${name}(search_platform で探してください)`);
        return textResult(doc);
      },
    },
    {
      name: "find_examples",
      description:
        "基盤機能の**使用例**(demos/)を探す。search_platform で部品が見つかったら、次にこれで『どう組み合わせるか』の実例を見る。" +
        "パッケージ名(csv / pdf / theme)でも、やりたいこと(請求書 / 承認フロー / 通知)でも引ける。",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "パッケージ名 or やりたいこと(日本語可)" },
          limit: { type: "number", description: "最大件数(既定 10)" },
        },
        required: ["query"],
      },
      handler: (args) => {
        const query = String(args.query ?? "");
        const limit = Number(args.limit ?? 10);
        if (!query.trim()) return errorResult("query を指定してください");
        const hits = searchDemos(demos, query, Math.min(Math.max(Number.isFinite(limit) ? limit : 10, 1), 30));
        if (hits.length === 0) {
          return textResult(`「${query}」の使用例は demos/ に見つかりませんでした。別の言い回しか、search_platform で部品自体を探してください。`);
        }
        const lines = hits.map((h) => `- **demos/${h.name}**\n  ${h.summary}\n  使用: ${h.packages.map((p) => `@platform/${p}`).join(", ") || "(なし)"}\n  一致: ${h.matched}`);
        return textResult(`「${query}」の使用例 ${hits.length} 件:\n\n${lines.join("\n")}\n\nソースは demos/<名前>/ にあります。`);
      },
    },
    {
      name: "explain_rules",
      description:
        "この基盤の設計ルール(層の分け方・依存の向き・命名・検証手順)を返す。**新しくコードを書く前に必ず呼ぶこと**。" +
        "topic を指定すると該当箇所のみ返す(例: 'layer' / 'store' / 'test' / 'naming')。省略時は全文。",
      inputSchema: {
        type: "object",
        properties: {
          topic: { type: "string", description: "知りたい話題(layer/store/test/naming など)。省略可" },
        },
      },
      handler: () => {
        const archPath = path.join(deps.root, "docs/ai/architecture.md");
        const claudePath = path.join(deps.root, "CLAUDE.md");
        const parts: string[] = [];
        if (existsSync(claudePath)) parts.push(readFileSync(claudePath, "utf8"));
        if (existsSync(archPath)) parts.push(readFileSync(archPath, "utf8"));
        if (parts.length === 0) return errorResult("設計ルールのドキュメントが見つかりません");
        return textResult(
          parts.join("\n\n---\n\n") +
            "\n\n---\n\n**検査コマンド**: `node tools/check-deps.mjs`(循環依存・層破り) / `node tools/preflight.mjs`(全ゲート一括)",
        );
      },
    },
    {
      name: "list_platform",
      description: "基盤パッケージをカテゴリ別に一覧する。全体像を掴みたいときに呼ぶ。",
      inputSchema: { type: "object", properties: {} },
      handler: () => {
        const cats = listByCategory(catalog);
        const lines = Object.entries(cats)
          .sort((a, b) => b[1].length - a[1].length)
          .map(([cat, pkgs]) => `## ${cat}（${pkgs.length}）\n${pkgs.join(", ")}`);
        return textResult(`基盤パッケージ ${catalog.length} 件:\n\n${lines.join("\n\n")}`);
      },
    },
  ];
}
