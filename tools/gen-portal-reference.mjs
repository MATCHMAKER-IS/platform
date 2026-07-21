/**
 * 基盤ポータル用の API リファレンスを固める(自動生成)。
 *   node tools/gen-portal-reference.mjs
 *
 * 入力: docs/platform/api-reference.json(gen-reference.mjs が作る)
 * 出力: demos/showcase/src/lib/portal-reference.generated.ts
 *
 * **実行時にファイルを読まない**ためにビルド時へ固める。
 * `process.cwd()` は Amplify の SSR で想定と違う場所を指すので、ファイル I/O に頼ると画面が壊れる
 * (gen-example-sources.mjs と同じ理由)。
 *
 * 生成物は **Server Component から import する**こと。クライアントへ 800KB 送らないため。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "./package-categories.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = path.join(ROOT, "docs/platform/api-reference.json");
const OUT = path.join(ROOT, "demos/showcase/src/lib/portal-reference.generated.ts");

/** パッケージ名 → カテゴリ(package-categories.mjs の逆引き)。 */
function categoryOf(name) {
  for (const [category, members] of Object.entries(CATEGORIES)) {
    if (members.includes(name)) return category;
  }
  return "その他";
}

/** packages/<name>/README.md の 1 行目の説明を取る(パッケージの概要)。 */
function summaryOf(name) {
  const readme = path.join(ROOT, "packages", name, "README.md");
  if (!existsSync(readme)) return "";
  const lines = readFileSync(readme, "utf8").split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (t === "" || t.startsWith("#")) continue;
    return t.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*`]/g, "").slice(0, 120);
  }
  return "";
}

function main() {
  if (!existsSync(SRC)) {
    console.error(`❌ ${path.relative(ROOT, SRC)} がありません。先に node tools/gen-reference.mjs を実行してください`);
    process.exit(1);
  }
  const ref = JSON.parse(readFileSync(SRC, "utf8"));
  const dirs = readdirSync(path.join(ROOT, "packages"));

  const packages = [];
  for (const [full, entries] of Object.entries(ref)) {
    const name = full.replace("@platform/", "");
    // packages/ は 107 だが、@platform/config は tsconfig と vitest の共通設定だけで
    // ランタイムコードを持たない(src/ が無い)ので api-reference.json に載らず、ここも 106 になる。
    // check-package-shape も同じ理由で config を対象外にしている。
    if (!dirs.includes(name)) continue;
    const fns = entries.filter((e) => e.kind === "function").length;
    const types = entries.filter((e) => e.kind === "interface" || e.kind === "type").length;
    packages.push({
      name,
      category: categoryOf(name),
      summary: summaryOf(name),
      functions: fns,
      types,
      // 一覧は重いので、詳細は entries に持たせる(Server Component 側で使う)
      entries: entries.map((e) => ({
        name: e.name,
        kind: e.kind,
        summary: e.summary ?? "",
        ...(e.signature ? { signature: e.signature } : {}),
        ...(e.params ? { params: e.params } : {}),
        ...(e.returns ? { returns: e.returns } : {}),
        ...(e.throws ? { throws: e.throws } : {}),
        ...(e.example ? { example: e.example } : {}),
      })),
    });
  }
  packages.sort((a, b) => a.name.localeCompare(b.name));

  const totalFns = packages.reduce((n, p) => n + p.functions, 0);
  const totalTypes = packages.reduce((n, p) => n + p.types, 0);

  const body = `/**
 * 基盤ポータル用の API リファレンス(自動生成・手で編集しない)。
 *
 * **実行時にファイルを読まない**ためビルド時に固めてある。
 * \`process.cwd()\` は Amplify の SSR で想定と違う場所を指すので、ファイル I/O に頼ると画面が壊れる。
 *
 * **Server Component から import すること。** クライアントへ送るとバンドルが 800KB 増える。
 *
 * 再生成: \`node tools/gen-portal-reference.mjs\`(\`pnpm gen:all\` に含まれる)
 * @packageDocumentation
 */

/** 関数の引数(TSDoc の @param)。 */
export interface RefParam {
  name: string;
  description: string;
}

/** 公開 API 1 件。 */
export interface RefEntry {
  name: string;
  kind: string;
  summary: string;
  /** 関数のみ。\`名前(引数): 戻り値\` の形。 */
  signature?: string;
  params?: RefParam[];
  returns?: string;
  throws?: string[];
  example?: string;
}

/** パッケージ 1 件。 */
export interface RefPackage {
  name: string;
  category: string;
  summary: string;
  functions: number;
  types: number;
  entries: RefEntry[];
}

/** 全 ${packages.length} パッケージ。 */
export const PORTAL_REFERENCE: RefPackage[] = ${JSON.stringify(packages, null, 0)};

/** 合計(画面の見出し用。手で数えない)。 */
export const PORTAL_TOTALS = { packages: ${packages.length}, functions: ${totalFns}, types: ${totalTypes} };
`;

  writeFileSync(OUT, body);
  console.log(`✅ ${path.relative(ROOT, OUT)} 生成: ${packages.length} パッケージ / 関数 ${totalFns} / 型 ${totalTypes}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
