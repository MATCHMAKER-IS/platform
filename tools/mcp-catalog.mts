/**
 * 基盤カタログ MCP サーバ(stdio)。Claude Code / Claude Desktop などの AI から
 * 「この機能は基盤にあるか」を検索できるようにする。車輪の再発明を防ぐのが目的。
 *
 * 起動:   pnpm mcp:catalog        ※要 pnpm install(オフライン環境では実行不可)
 * 接続:   docs/ai/mcp-catalog.md を参照(Claude Desktop / Claude Code の設定へマージ)
 * 注意:   stdout は MCP プロトコル専用。ログは必ず stderr(console.error)へ。
 *
 * 読み取り専用。リポジトリのファイルを変更することはない。
 */
import { serveStdio } from "@platform/mcp";
import { buildCatalogTools } from "./lib/catalog-tools.mjs";
import { loadCatalog, loadDemos } from "./lib/catalog.mjs";

const ROOT = new URL("..", import.meta.url).pathname;

// 起動時に一度だけ読む(生成物が更新されたら再起動する)
const catalog = loadCatalog({ root: ROOT });
const demos = loadDemos({ root: ROOT });
console.error(`[mcp:catalog] ${catalog.length} パッケージ / ${demos.length} デモを読み込みました`);

await serveStdio({ name: "platform-catalog", version: "0.1.0", tools: buildCatalogTools({ root: ROOT, catalog, demos }) });
