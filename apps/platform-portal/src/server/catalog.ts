/**
 * 基盤カタログの構築。リポジトリの成果物(api-surface / module-list / README / ヘルスレポート / ADR)を
 * 読み取り、Portal 用の統一データにする。fs アクセスはサーバ側(Route Handler)からのみ。
 * @packageDocumentation
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

/** リポジトリルート(apps/platform-portal から2つ上)。 */
const ROOT = path.resolve(process.cwd(), "..", "..");
const read = (rel: string): string => (existsSync(path.join(ROOT, rel)) ? readFileSync(path.join(ROOT, rel), "utf8") : "");

/** パッケージ1件。 */
export interface ReferenceEntry {
  name: string;
  kind: string;
  summary: string;
}

export interface PackageInfo {
  name: string;
  category: string;
  summary: string;
  exports: string[];
  hasReadme: boolean;
  reference: ReferenceEntry[];
}

/** ADR1件。 */
export interface AdrInfo {
  id: string;
  title: string;
  status: string;
  file: string;
}

/** カタログ全体。 */
export interface Catalog {
  generatedAt: string;
  packages: PackageInfo[];
  categories: { name: string; count: number }[];
  adrs: AdrInfo[];
  health: { label: string; value: string }[];
  advisor: { sameNameCount: number; similarCount: number; isolated: { name: string; reason: string }[] };
  erds: { app: string; mermaid: string }[];
  appmaps: { app: string; pages: number; apis: number; flowchart: string }[];
  depgraph: { mermaid: string; topDepended: { name: string; count: number }[] };
}

function loadCategoryMap(): Record<string, string> {
  // module-list.md(カテゴリ別見出し + `- **@platform/x**`)からカテゴリを復元
  const md = read("docs/ai/module-list.md");
  const map: Record<string, string> = {};
  let current = "";
  for (const line of md.split("\n")) {
    const h = line.match(/^##\s+(.+)$/);
    if (h && h[1]) { current = h[1].trim(); continue; }
    const p = line.match(/\*\*@platform\/([a-z-]+)\*\*/);
    if (p && p[1]) map[p[1]] = current;
  }
  return map;
}

function firstReadmeLine(pkg: string): string {
  const md = read(`packages/${pkg}/README.md`);
  const line = md.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#"));
  return (line ?? "").replace(/\*\*/g, "").replace(/`/g, "");
}

function loadHealth(): { label: string; value: string }[] {
  const md = read("docs/ai/platform-report.md");
  const rows: { label: string; value: string }[] = [];
  for (const line of md.split("\n")) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/);
    if (m && m[1] && m[2] && m[1] !== "指標" && !m[1].includes("---")) rows.push({ label: m[1], value: m[2] });
  }
  return rows.slice(0, 8);
}

function loadAdrs(): AdrInfo[] {
  const dir = path.join(ROOT, "docs/adr");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d{4}-.+\.md$/.test(f))
    .sort()
    .map((f) => {
      const body = readFileSync(path.join(dir, f), "utf8");
      const titleLine = body.split("\n").find((l) => l.startsWith("# ")) ?? f;
      const title = titleLine.replace(/^#\s*(ADR\s*)?\d{4}:?\s*/i, "").replace(/^#\s*\d+\.\s*/, "").replace(/^#\s*/, "").trim();
      const statusLine = body.split("\n").find((l) => l.includes("状態")) ?? "";
      const status = statusLine.match(/状態[:：]?\s*([^\/|]+)/)?.[1]?.trim() ?? "採用";
      return { id: f.slice(0, 4), title, status, file: f };
    });
}

/** カタログを構築する。 */
export function buildCatalog(): Catalog {
  const surfaceRaw = read("docs/platform/api-surface.json");
  const surface: Record<string, string[]> = surfaceRaw ? JSON.parse(surfaceRaw) : {};
  const refRaw = read("docs/platform/api-reference.json");
  const reference: Record<string, ReferenceEntry[]> = refRaw ? JSON.parse(refRaw) : {};
  const categoryMap = loadCategoryMap();
  const pkgDir = path.join(ROOT, "packages");
  const names = existsSync(pkgDir) ? readdirSync(pkgDir).filter((d) => existsSync(path.join(pkgDir, d, "package.json"))).sort() : [];

  const packages: PackageInfo[] = names.map((name) => ({
    name,
    category: categoryMap[name] ?? "その他",
    summary: firstReadmeLine(name),
    exports: surface[`@platform/${name}`] ?? [],
    hasReadme: existsSync(path.join(pkgDir, name, "README.md")),
    reference: reference[`@platform/${name}`] ?? [],
  }));

  const catCount = new Map<string, number>();
  for (const p of packages) catCount.set(p.category, (catCount.get(p.category) ?? 0) + 1);

  return {
    generatedAt: new Date().toISOString(),
    packages,
    categories: [...catCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    adrs: loadAdrs(),
    health: loadHealth(),
    advisor: buildAdvisor(packages),
    erds: loadErds(),
    appmaps: loadAppmaps(),
    depgraph: loadDepgraph(),
  };
}

function loadDepgraph(): { mermaid: string; topDepended: { name: string; count: number }[] } {
  const f = path.join(ROOT, "docs/platform/depgraph.md");
  if (!existsSync(f)) return { mermaid: "", topDepended: [] };
  const body = readFileSync(f, "utf8");
  const mm = body.match(/## カテゴリ間の依存[\s\S]*?```mermaid\n([\s\S]*?)```/);
  const topDepended: { name: string; count: number }[] = [];
  const section = body.match(/## よく使われる基盤パッケージ[\s\S]*?(?=\n## )/);
  if (section) {
    for (const m of section[0].matchAll(/\| `@platform\/([a-z-]+)` \| (\d+) \|/g)) {
      topDepended.push({ name: m[1] ?? "", count: Number(m[2]) });
    }
  }
  return { mermaid: mm ? (mm[1] ?? "").trim() : "", topDepended };
}

function loadAppmaps(): { app: string; pages: number; apis: number; flowchart: string }[] {
  const dir = path.join(ROOT, "docs/platform/appmap");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => {
    const body = readFileSync(path.join(dir, f), "utf8");
    const pages = Number(body.match(/## 画面\((\d+)\)/)?.[1] ?? 0);
    const apis = Number(body.match(/## API\((\d+)\)/)?.[1] ?? 0);
    const fc = body.match(/## 画面遷移[\s\S]*?```mermaid\n([\s\S]*?)```/);
    return { app: f.replace(/\.md$/, ""), pages, apis, flowchart: fc ? (fc[1] ?? "").trim() : "" };
  });
}

function loadErds(): { app: string; mermaid: string }[] {
  const dir = path.join(ROOT, "docs/platform/erd");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => {
    const body = readFileSync(path.join(dir, f), "utf8");
    const m = body.match(/```mermaid\n([\s\S]*?)```/);
    return { app: f.replace(/\.md$/, ""), mermaid: m ? (m[1] ?? "").trim() : "" };
  }).filter((e) => e.mermaid.length > 0);
}

function buildAdvisor(packages: PackageInfo[]): Catalog["advisor"] {
  const owners = new Map<string, string[]>();
  for (const p of packages) for (const e of p.exports) {
    const list = owners.get(e) ?? [];
    list.push(p.name);
    owners.set(e, list);
  }
  const sameNameCount = [...owners.values()].filter((o) => o.length > 1).length;
  const concept = (name: string) => name.replace(/^(create|make|build|get|set|is|has|use|to|from|parse|format|with)/i, "").replace(/(Store|Adapter|Options|Result|Config|Client|Provider|Def|Info|Input|Output|Handler|Service)$/i, "").toLowerCase();
  const conceptOwners = new Map<string, Set<string>>();
  for (const p of packages) for (const e of p.exports) {
    const c = concept(e);
    if (c.length < 4) continue;
    const set = conceptOwners.get(c) ?? new Set<string>();
    set.add(p.name);
    conceptOwners.set(c, set);
  }
  const similarCount = [...conceptOwners.values()].filter((s) => s.size > 1).length;
  const isolated = packages.filter((p) => p.exports.length === 0 || p.summary === "").map((p) => ({ name: p.name, reason: p.exports.length === 0 ? "public export なし" : "README 要約なし" }));
  return { sameNameCount, similarCount, isolated };
}
