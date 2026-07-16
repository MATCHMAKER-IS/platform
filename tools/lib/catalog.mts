/**
 * 基盤カタログ MCP のツール定義。AI(Claude Code / Claude Desktop 等)が
 * 「こういう機能は基盤にあるか」を検索し、車輪の再発明を避けられるようにする。
 *
 * ロジックは純関数として分離し、MCP サーバ(server.mts)から使う。
 * データ源は生成物(api-reference.json / module-list など)とパッケージの README。
 * @packageDocumentation
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

/** パッケージ 1 件の情報。 */
export interface PackageEntry {
  name: string;
  full: string;
  summary: string;
  category: string;
  exports: { name: string; kind: string; summary: string }[];
}

/** 検索結果 1 件。 */
export interface SearchHit {
  full: string;
  summary: string;
  category: string;
  /** 一致した理由(パッケージ名 / 説明 / API 名)。 */
  matched: string;
  /** 一致した API 名(あれば)。 */
  api?: string;
  /** 関連度スコア(高いほど良い)。 */
  score: number;
}

export interface CatalogDeps {
  /** リポジトリルート。 */
  root: string;
}

/** カテゴリ表(package-categories.mjs と同じ分類を使う)。読めなければ空。 */
function loadCategories(root: string): Record<string, string> {
  const f = path.join(root, "docs/ai/module-list.md");
  if (!existsSync(f)) return {};
  const map: Record<string, string> = {};
  let current = "";
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const cat = line.match(/^##\s+(.+)$/);
    if (cat && cat[1]) { current = cat[1].trim(); continue; }
    const pkg = line.match(/^-\s+\*\*@platform\/([a-z0-9-]+)\*\*/);
    if (pkg && pkg[1] && current) map[pkg[1]] = current;
  }
  return map;
}

/** すべてのパッケージ情報を読む。 */
export function loadCatalog(deps: CatalogDeps): PackageEntry[] {
  const { root } = deps;
  // 説明付きの API(JSDoc 要約があるものだけ載る)
  const refPath = path.join(root, "docs/platform/api-reference.json");
  const apiRef: Record<string, { name: string; kind: string; summary?: string }[]> = existsSync(refPath)
    ? JSON.parse(readFileSync(refPath, "utf8"))
    : {};
  // 全 export の一覧(説明は無いが漏れがない)。両方を突き合わせて網羅する。
  const surfacePath = path.join(root, "docs/platform/api-surface.json");
  const surface: Record<string, string[]> = existsSync(surfacePath)
    ? JSON.parse(readFileSync(surfacePath, "utf8"))
    : {};
  const categories = loadCategories(root);
  const pkgDir = path.join(root, "packages");
  if (!existsSync(pkgDir)) return [];

  const out: PackageEntry[] = [];
  for (const name of readdirSync(pkgDir)) {
    if (!existsSync(path.join(pkgDir, name, "package.json"))) continue;
    const full = `@platform/${name}`;
    let summary = "";
    const readme = path.join(pkgDir, name, "README.md");
    if (existsSync(readme)) {
      const lines = readFileSync(readme, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
      summary = lines.find((l) => !l.startsWith("#")) ?? "";
    }
    // 説明付き API を優先し、api-surface にしか無いものは説明なしで足す
    const described = new Map((apiRef[full] ?? []).map((e) => [e.name, { name: e.name, kind: e.kind, summary: e.summary ?? "" }]));
    for (const n of surface[full] ?? []) {
      if (!described.has(n)) described.set(n, { name: n, kind: "export", summary: "" });
    }
    out.push({
      name,
      full,
      summary,
      category: categories[name] ?? "未分類",
      exports: [...described.values()].sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * キーワードでパッケージ・API を検索する。
 * 名前の一致を最優先し、次に API 名、説明の順でスコアリングする。
 */
export function searchCatalog(catalog: PackageEntry[], query: string, limit = 10): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const hits: SearchHit[] = [];

  for (const pkg of catalog) {
    let score = 0;
    let matched = "";
    let api: string | undefined;

    for (const term of terms) {
      if (pkg.name === term) { score += 100; matched = "パッケージ名(完全一致)"; }
      else if (pkg.name.includes(term)) { score += 50; matched = matched || "パッケージ名"; }
      const hitApi = pkg.exports.find((e) => e.name.toLowerCase() === term);
      if (hitApi) { score += 40; matched = matched || "API名(完全一致)"; api = hitApi.name; }
      else {
        const partial = pkg.exports.find((e) => e.name.toLowerCase().includes(term));
        if (partial) { score += 20; matched = matched || "API名"; api = api ?? partial.name; }
      }
      if (pkg.summary.toLowerCase().includes(term)) { score += 15; matched = matched || "説明"; }
      const apiSummaryHit = pkg.exports.find((e) => e.summary.toLowerCase().includes(term));
      if (apiSummaryHit) { score += 10; matched = matched || "API の説明"; api = api ?? apiSummaryHit.name; }
    }
    if (score > 0) {
      hits.push({ full: pkg.full, summary: pkg.summary, category: pkg.category, matched, score, ...(api ? { api } : {}) });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** パッケージ 1 件の詳細(README 全文 + 公開 API)。 */
export function describePackage(catalog: PackageEntry[], root: string, name: string): string | null {
  const key = name.replace(/^@platform\//, "");
  const pkg = catalog.find((p) => p.name === key);
  if (!pkg) return null;
  const readme = path.join(root, "packages", key, "README.md");
  const doc = existsSync(readme) ? readFileSync(readme, "utf8") : `# ${pkg.full}\n\n${pkg.summary}`;
  const apis = pkg.exports.length > 0
    ? "\n\n## 公開 API\n\n" + pkg.exports.map((e) => `- \`${e.name}\` (${e.kind})${e.summary ? ` — ${e.summary}` : ""}`).join("\n")
    : "";
  return `${doc}${apis}`;
}

/** カテゴリ別の一覧(AI が全体像を掴むため)。 */
export function listByCategory(catalog: PackageEntry[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const p of catalog) {
    (out[p.category] ??= []).push(p.full);
  }
  return out;
}

/** デモ 1 件の情報。 */
export interface DemoEntry {
  name: string;
  /** README の冒頭(何をするデモか)。 */
  summary: string;
  /** このデモが使っている基盤パッケージ(README とソースの import から抽出)。 */
  packages: string[];
}

/** demos/ の一覧を読む。「この機能の使用例はどこ?」に答えるため。 */
export function loadDemos(deps: CatalogDeps): DemoEntry[] {
  // 統合デモサイト(demos/showcase)の nav.ts が唯一の出典。
  // 以前は demos/* の各フォルダを走査していたが、1 サイトに集約したため
  // nav.ts の DemoEntry を読む(サイトの表示と検索結果が食い違わない)。
  const navPath = path.join(deps.root, "demos/showcase/src/lib/nav.ts");
  if (!existsSync(navPath)) return [];
  const src = readFileSync(navPath, "utf8");

  const out: DemoEntry[] = [];
  // { href: "...", title: "...", desc: "...", packages: [...] } を拾う
  const re = /\{\s*href:\s*"([^"]+)",\s*title:\s*"([^"]+)",\s*desc:\s*"([^"]+)",\s*\n?\s*packages:\s*\[([^\]]*)\]/g;
  for (const m of src.matchAll(re)) {
    const href = m[1] ?? "";
    const title = m[2] ?? "";
    const desc = m[3] ?? "";
    const packages = [...(m[4] ?? "").matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1] ?? "").filter(Boolean).sort();
    // name は href の末尾(/apps/internal → apps-internal)
    const name = href.replace(/^\//, "").replace(/\//g, "-") || "home";
    out.push({ name, summary: `${title} — ${desc}`, packages });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** デモ検索の結果。 */
export interface DemoHit {
  name: string;
  summary: string;
  packages: string[];
  matched: string;
  score: number;
}

/**
 * 「この基盤機能を使っている例はどこ?」を探す。
 * パッケージ名(csv / theme 等)でも、やりたいこと(請求書 / 承認 等)でも引ける。
 */
export function searchDemos(demos: DemoEntry[], query: string, limit = 10): DemoHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean).map((t) => t.replace(/^@platform\//, ""));
  const hits: DemoHit[] = [];
  for (const d of demos) {
    let score = 0;
    let matched = "";
    for (const term of terms) {
      if (d.name === term) { score += 100; matched = "デモ名(完全一致)"; }
      else if (d.name.includes(term)) { score += 50; matched = matched || "デモ名"; }
      if (d.packages.includes(term)) { score += 40; matched = matched || "使用パッケージ"; }
      else if (d.packages.some((p) => p.includes(term))) { score += 15; matched = matched || "使用パッケージ(部分)"; }
      if (d.summary.toLowerCase().includes(term)) { score += 20; matched = matched || "説明"; }
    }
    if (score > 0) hits.push({ name: d.name, summary: d.summary, packages: d.packages, matched, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
