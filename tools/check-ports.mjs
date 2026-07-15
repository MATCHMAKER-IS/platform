/**
 * 開発サーバのポート割り当てを検査する。
 *   node tools/check-ports.mjs
 *
 * `pnpm dev`(turbo run dev)は全アプリを**一斉起動**するため、ポートが重複していると
 * 片方が起動に失敗する。package.json の dev スクリプトに --port が無いと Next.js の既定
 * (3000)を取りに行き、静かに衝突する。ここで機械的に検出する。
 *
 * ドキュメント(docs/APPS_AND_DEMOS.md)に書かれたポートとの一致も見る。
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname;

/** dev スクリプトを持つワークスペースのポートを集める。 */
export function collectPorts() {
  const entries = [];
  for (const area of ["apps", "demos"]) {
    const dir = path.join(ROOT, area);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const pkgPath = path.join(dir, name, "package.json");
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      const dev = pkg.scripts?.dev;
      if (!dev || !dev.includes("next dev")) continue;
      const m = dev.match(/--port[= ](\d+)/);
      entries.push({
        workspace: `${area}/${name}`,
        name,
        dev,
        port: m ? Number(m[1]) : null, // null = 未指定(既定 3000 を取りに行く)
      });
    }
  }
  return entries.sort((a, b) => (a.port ?? 3000) - (b.port ?? 3000));
}

/** ドキュメントに書かれた「アプリ名 → ポート」を拾う。複数の資料を突き合わせる。 */
export function docPorts() {
  const map = {};

  // 1) APPS_AND_DEMOS.md: 見出し「### 1. internal-app — …」の近くに localhost:3000
  const f1 = path.join(ROOT, "docs/APPS_AND_DEMOS.md");
  if (existsSync(f1)) {
    const body = readFileSync(f1, "utf8");
    const re = /###\s*\d*\.?\s*([a-z-]+)[^\n]*\n[\s\S]{0,200}?localhost:(\d{4})/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      if (m[1] && m[2]) map[m[1]] = { port: Number(m[2]), file: "docs/APPS_AND_DEMOS.md" };
    }
  }

  // 2) SETUP.md のポート表: 「| 3000 | internal-app | ...」
  const f2 = path.join(ROOT, "docs/ops/SETUP.md");
  if (existsSync(f2)) {
    const body = readFileSync(f2, "utf8");
    const re = /^\|\s*(\d{4})\s*\|\s*(?:@demos\/)?([a-z-]+)\s*\|/gm;
    let m;
    while ((m = re.exec(body)) !== null) {
      const port = Number(m[1]);
      const name = m[2];
      // インフラ(PostgreSQL 等)は対象外。アプリ名だけ拾う
      if (!name || port < 3000 || port > 3099) continue;
      map[name] = { port, file: "docs/ops/SETUP.md" };
    }
  }
  return map;
}

export function check() {
  const entries = collectPorts();
  const issues = [];

  // 1. ポート未指定(既定 3000 の取り合いになる)
  for (const e of entries) {
    if (e.port === null) {
      issues.push(`${e.workspace}: dev スクリプトに --port がありません(既定 3000 を取りに行き、一斉起動で衝突します)`);
    }
  }

  // 2. ポート重複
  const byPort = new Map();
  for (const e of entries) {
    const p = e.port ?? 3000;
    if (!byPort.has(p)) byPort.set(p, []);
    byPort.get(p).push(e.workspace);
  }
  for (const [port, ws] of byPort) {
    if (ws.length > 1) issues.push(`ポート ${port} が重複: ${ws.join(", ")}`);
  }

  // 3. ドキュメントとの不一致
  const docs = docPorts();
  for (const e of entries) {
    const doc = docs[e.name];
    if (doc !== undefined && e.port !== null && doc.port !== e.port) {
      issues.push(`${e.workspace}: 実際は ${e.port} ですが ${doc.file} には ${doc.port} と書かれています`);
    }
  }

  return { entries, issues };
}

function main() {
  const { entries, issues } = check();
  for (const e of entries) {
    console.log(`  ${String(e.port ?? "未指定").padStart(5)} ${e.workspace}`);
  }
  if (issues.length === 0) {
    console.log(`✅ ポート割り当ては重複なし(${entries.length} アプリ)。一斉起動(pnpm dev)しても衝突しません`);
    return;
  }
  console.error("");
  for (const i of issues) console.error(`❌ ${i}`);
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
