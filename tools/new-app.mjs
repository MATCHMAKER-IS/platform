#!/usr/bin/env node
/**
 * 新しいアプリを `crud-template` から作る。
 *
 * 【なぜ要るか】
 * 手順書(`docs/ops/NEW_APP.md`)どおりにコピーすると、
 * **アプリ名を 5 ファイル・ポートを 2 か所**手で直すことになる。
 * 直し漏れると、`pnpm dev` で既存アプリとポートが衝突したり、
 * 監査ログに前のアプリ名が残ったりする。
 *
 * 【何をしないか】
 * **業務のモデルは作らない。** 「品目」を何に変えるかは、
 * 作る人が決めること。ここは**箱を用意するところまで**。
 *
 *   pnpm new-app shipping "配送管理"
 *   pnpm new-app shipping "配送管理" --dry   # 何をするか見るだけ
 *
 * 【消すとき】
 * `apps/<名前>` を消し、ルートの `package.json` から
 * `dev:<名前>` を消す。**2 か所**なので、試すときは `--dry` で
 * 先に確かめる方が早い。
 */
import { access, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FEATURES } from "./app-features.mjs";
import { extraPackageChoices } from "./app-packages.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = path.join(ROOT, "apps/crud-template");

const args = process.argv.slice(2);
// **何をするか先に見せる。** 作ってから「違った」となると、
// ディレクトリとルートの `package.json` を手で戻すことになる
const DRY = args.includes("--dry");
const [name, title] = args.filter((a) => !a.startsWith("--"));

// **選べるものを一覧で出す。** 対話は端末でしか動かないので、
// 手順書や PR の説明に書くには、**目で見て確かめられる形**が要る
if (args.includes("--list")) {
  const extras = extraPackageChoices();
  console.log("【機能】繋ぎ方の見本つき（ファイル・環境変数・README も入ります）\n");
  for (const f of FEATURES) {
    console.log(`  ${f.id.padEnd(12)} ${f.label}`);
    console.log(`  ${" ".repeat(12)} ${f.hint}`);
  }
  console.log(`\n【部品】依存を足すだけ（繋ぎ方は各 README を読んでください）\n`);
  let cat = "";
  for (const f of extras) {
    if (f.category !== cat) { cat = f.category; console.log(`  ── ${cat} ──`); }
    console.log(`  ${f.id.padEnd(20)} ${f.hint}`);
  }
  console.log(`\n  機能 ${FEATURES.length} / 部品 ${extras.length} = 合計 ${FEATURES.length + extras.length} 件`);
  console.log("  指定: pnpm new-app <名前> \"<説明>\" --features=login,pkg:address");
  process.exit(0);
}

if (name === undefined || title === undefined) {
  console.error("使い方: pnpm new-app <名前> \"<説明>\"");
  console.error("  例: pnpm new-app shipping \"配送管理\"");
  console.error("  選べるものの一覧: pnpm new-app --list");
  console.error("");
  console.error("名前は英小文字とハイフンだけ(ディレクトリ名とパッケージ名になります)。");
  process.exit(1);
}

// **名前を先に確かめる。** 途中で失敗すると中途半端な状態が残る
if (!/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error(`❌ 名前は英小文字で始まり、英小文字・数字・ハイフンだけです: ${name}`);
  process.exit(1);
}

const dest = path.join(ROOT, "apps", name);
try {
  await access(dest);
  console.error(`❌ apps/${name} は既にあります`);
  process.exit(1);
} catch { /* 無いのが正しい */ }

/**
 * 空いているポートを探す。
 *
 * **手で決めさせない。** 手順書は「1 で決めたポート」と書くが、
 * 既存を調べるのを忘れると `pnpm dev`(一斉起動)で衝突する。
 */
async function nextPort() {
  const used = new Set();
  for (const group of ["apps", "demos"]) {
    let dirs;
    try { dirs = await readdir(path.join(ROOT, group)); } catch { continue; }
    for (const d of dirs) {
      try {
        const pkg = JSON.parse(await readFile(path.join(ROOT, group, d, "package.json"), "utf8"));
        const m = /--port\s+(\d+)/.exec(pkg.scripts?.dev ?? "");
        if (m !== null) used.add(Number(m[1]));
      } catch { /* package.json 無しは無視 */ }
    }
  }
  let p = 3000;
  while (used.has(p)) p += 1;
  return p;
}

const port = await nextPort();

console.log(`▶ apps/${name} を作ります(ポート ${port})`);

if (DRY) {
  console.log("");
  console.log("   (--dry のため作りません)");
  console.log(`   作るもの: apps/${name}/`);
  console.log(`   置き換え: crud-template → ${name} / 品目マスタ → ${title} / ポート → ${port}`);
  console.log(`   ルートに \`pnpm dev:${name}\` を足します`);

  // **選んだものも見せる。** ここで終わってしまうと、
  // `--features=` の綴りが合っているか **作るまで分からない**——
  // 「作ってから違った」を避けるための `--dry` なのに、肝心の部分が見えない
  const dryArg = args.find((a) => a.startsWith("--features="));
  if (dryArg !== undefined) {
    const all = [...FEATURES, ...extraPackageChoices()];
    console.log("");
    for (const id of dryArg.slice("--features=".length).split(",")) {
      const f = all.find((x) => x.id === id.trim());
      if (f === undefined) {
        console.log(`   ⚠ 知らない指定: ${id.trim()}（一覧は pnpm new-app --list）`);
        continue;
      }
      const kind = f.packageOnly === true ? "部品" : "機能";
      console.log(`   ${kind}: ${f.label}`);
      console.log(`         依存 ${(f.deps ?? []).join(", ")}`);
      if (f.packageOnly !== true) {
        const files = Object.keys(f.files ?? {});
        if (files.length > 0) console.log(`         ファイル ${files.join(", ")}`);
        if ((f.env ?? []).length > 0) console.log("         .env.example に追記あり");
      }
    }
  }
  console.log("");
  process.exit(0);
}

// **生成物とビルド結果は持っていかない。** 前のアプリのものが混ざる
await cp(TEMPLATE, dest, {
  recursive: true,
  filter: (src) => !/(node_modules|\.next|src[/\\]generated)/.test(src),
});

/** ファイルの中の置き換え。 */
const REPLACEMENTS = [
  [/crud-template/g, name],
  [/品目マスタ/g, title],
  [/--port 3002/g, `--port ${port}`],
];

/** 対象を再帰的に書き換える。 */
async function rewrite(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { await rewrite(p); continue; }
    if (!/\.(ts|tsx|json|md|mjs|prisma|example)$/.test(e.name) && e.name !== ".env.example") continue;
    let body = await readFile(p, "utf8");
    const before = body;
    for (const [from, to] of REPLACEMENTS) body = body.replace(from, to);
    if (body !== before) await writeFile(p, body);
  }
}
await rewrite(dest);

// **README は作り直す。** 雛形の説明が残ると、何のアプリか分からない
await writeFile(path.join(dest, "README.md"), `# ${name} — ${title}

\`crud-template\` から作りました(\`pnpm new-app\`)。

## このアプリの運用

**基盤の手順は \`docs/ops/\` にあります。** ここには**このアプリ固有のこと**だけを書きます。

### 出し先

**まだ決まっていません。**（決めたらここに書いてください）

### 試験の状況

| 種類 | 状況 |
|---|---|
| smoke | 基盤側で全体を確認しています |
| E2E | **未整備** |

### 動かすのに要るもの

- PostgreSQL（\`docker compose up -d\`）
- \`.env\`（\`.env.example\` を写して埋める）

**認証情報が無くても起動します**——**使ったときに初めて失敗**します。

## 起動

\`\`\`bash
pnpm --filter ${name} dev   # http://localhost:${port}
\`\`\`

## 次にやること

1. \`prisma/schema.prisma\` のモデルを、このアプリのものに変える
2. \`src/server/item-repo.ts\` を作り直す(ファイル名も変える)
3. \`src/app/items-client.tsx\` の画面を組み替える
4. \`src/server/authorize.ts\` の権限名を決める

## 消してはいけないもの

雛形が持っている守りです。**どのアプリでも必ず要る**ため、
理由が無い限り残してください(詳しくは \`apps/crud-template/README.md\`)。

- \`withApi\` の回数制限・CSRF 対策・本文サイズ
- \`middleware.ts\` の CSP + nonce
- \`global-error.tsx\`(レイアウトごと壊れたときの受け皿)
- \`api/health\` \`api/ready\`(落ちても気づけるように)
- 監査ログ(\`recordAudit\`)
`);

// **引き継ぎ資料も作る。**
// **無いと、気づいたことを基盤の HANDOVER（800 行）に書くことになり、
// 埋もれて誰も探せません**——最初から置いておきます。
// （検査 `引き継ぎ: 各アプリに HANDOVER がある` で見張っています）
await writeFile(path.join(dest, "HANDOVER.md"), `# ${name} の引き継ぎ

**このアプリ固有のことだけを書きます。**

基盤（\`packages/\` \`tools/\`）のことは \`docs/ops/HANDOVER.md\` にあります。

## どちらに書くか

| 内容 | 書く場所 |
|---|---|
| **このアプリの画面・API・DB スキーマ** | **ここ** |
| このアプリの業務ルール | **ここ** |
| このアプリでの外部サービスの設定値 | **ここ** |
| \`packages/\` の関数の仕様・落とし穴 | \`docs/ops/HANDOVER.md\` |
| \`tools/\` の検査 | \`docs/ops/HANDOVER.md\` |

**判断の基準**: **他のアプリでも起きるなら基盤側**、
**このアプリでしか起きないならここ**です。

**迷ったら基盤側に書いてください。** ここに書いたものは、
**別のアプリを作る人が読みません**——**同じ失敗を繰り返します**。

---

## このアプリは何か

${title}

（**何のために作ったか**を書いてください。「便利だから」ではなく、
**無いと何が困るか**を——半年後の自分が読みます）

---

## 気づいたこと

**新しいものを上に足してください。** 上ほど最近の判断です。

| 場所 | なぜ危ないか |
|---|---|
| （まだありません） | **踏んだ落とし穴をここに書いてください**——**「何をするか」より「何を間違えやすいか」**です |

---

## このアプリで終わっていないこと

**基盤側の「終わっていないこと」（\`docs/ops/HANDOVER.md\`）も必ず見てください。**

| 何 | なぜ困るか |
|---|---|
| （まだありません） | |
`);

// **ルートの `package.json` に起動コマンドを足す。**
// 手順書は手で足すよう書いていたが、忘れると
// `pnpm dev:xxx` が無いまま「動かない」と言われる(2026-08)
const rootPkgPath = path.join(ROOT, "package.json");
const rootPkg = JSON.parse(await readFile(rootPkgPath, "utf8"));
const scriptKey = `dev:${name}`;
if (rootPkg.scripts[scriptKey] === undefined) {
  rootPkg.scripts[scriptKey] = `pnpm --filter ${name} dev`;
  // **並びを保つ。** 追加のたびに末尾へ足すと、探しづらくなる
  rootPkg.scripts = Object.fromEntries(
    Object.entries(rootPkg.scripts).sort(([a], [b]) => a.localeCompare(b)),
  );
  await writeFile(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`);
  console.log(`   ルートに \`pnpm ${scriptKey}\` を足しました`);
}

// ── 使う機能を選ぶ ──────────────────────────────────────────
//
// **雛形は最小構成**(DB + 認可 + 一覧画面)です。ログインや通知は
// **使うと決めてから足す**方がよい——入れておくと
// **「使っていない設定」が増えて、何が要るのか分からなくなる**。
const selected = [];
// **表示した順**を覚えておく（番号と中身を合わせるため）
const ordered = [];

// **`--features=login,upload` でも指定できる。**
// 対話は端末でしか動かないので、**手順書や CI で再現できない**
const featArg = args.find((a) => a.startsWith("--features="));
if (featArg !== undefined) {
  // **部品（`pkg:住所` など）も同じ書き方で指定できる。**
  // 機能と部品で書式が違うと、手順書に 2 通り書くことになる
  const all = [...FEATURES, ...extraPackageChoices()];
  for (const id of featArg.slice("--features=".length).split(",")) {
    const f = all.find((x) => x.id === id.trim());
    if (f !== undefined) selected.push(f);
    else {
      console.log(`   ⚠ 知らない指定: ${id.trim()}`);
      console.log(`     機能: ${FEATURES.map((x) => x.id).join(" / ")}`);
      console.log("     部品: pkg:<パッケージ名>（一覧は pnpm new-app --list）");
    }
  }
} else if (!args.includes("--yes") && !DRY && process.stdin.isTTY === true) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log("");
  console.log("  使う機能を選んでください（後から足せます。番号をスペース区切りで、無ければ Enter）");
  console.log("");
  // **分類ごとに出す。** 26 個を並べると**探せません**。
  //
  // **番号は「表示した順」で振る。** `FEATURES` の並び順で振ると、
  // 同じ分類が飛び飛びのときに**画面の番号と中身がずれます**。
  const byCategory = new Map();
  for (const f of FEATURES) {
    if (!byCategory.has(f.category)) byCategory.set(f.category, []);
    byCategory.get(f.category).push(f);
  }
  ordered.push(...[...byCategory.values()].flat());
  let shown = 0;
  for (const [cat, list] of byCategory) {
    console.log(`  ── ${cat} ──`);
    for (const f of list) {
      shown += 1;
      console.log(`    ${String(shown).padStart(2)}. ${f.label}`);
      console.log(`        ${f.hint}`);
    }
    console.log("");
  }
  // **部品は「見せてほしい」と言われてから出す。**
  //
  // 機能 26 + 部品 60 を一度に並べると **86 行**になり、
  // **探すのを諦めさせます**——「よく使うものが上にある」という
  // 並び順の意味も消えます。
  //
  // 機能は「繋ぎ方の見本つき」で、部品は「依存を足すだけ」。
  // **まず機能から選んでもらう**のが、多くの場合に正しい順序です。
  console.log("  ── そのほかの部品 ──");
  console.log("    p. 基盤の部品を一覧から選ぶ（住所・バーコード・単位換算など 60 件）");
  console.log("");
  const answer = await rl.question("  番号（例: 1 4、部品を見るなら p）> ");
  for (const token of answer.trim().split(/\s+/)) {
    const i3 = Number(token) - 1;
    if (Number.isInteger(i3) && ordered[i3] !== undefined) selected.push(ordered[i3]);
  }

  // **部品の一覧を出す。** ここも分類ごとに並べる
  if (/^p$/i.test(answer.trim()) || answer.trim().split(/\s+/).some((t) => /^p$/i.test(t))) {
    const extras = extraPackageChoices();
    const byCat = new Map();
    for (const f of extras) {
      if (!byCat.has(f.category)) byCat.set(f.category, []);
      byCat.get(f.category).push(f);
    }
    const flat = [...byCat.values()].flat();
    console.log("");
    console.log("  基盤の部品（**依存を足すだけ**です。繋ぎ方は各 README を読んでください）");
    console.log("");
    let n = 0;
    for (const [cat, list] of byCat) {
      console.log(`  ── ${cat} ──`);
      for (const f of list) {
        n += 1;
        console.log(`    ${String(n).padStart(2)}. ${f.label}`);
        // **説明を必ず出す。** 名前だけでは何ができるか分からない
        //（`zengin` `dencho` `saga` は、知らなければ想像もつかない）
        if (f.hint !== "") console.log(`        ${f.hint}`);
      }
      console.log("");
    }
    const a2 = await rl.question("  番号（例: 3 12、要らなければ Enter）> ");
    for (const token of a2.trim().split(/\s+/)) {
      const i4 = Number(token) - 1;
      if (Number.isInteger(i4) && flat[i4] !== undefined) selected.push(flat[i4]);
    }
  }
  rl.close();
}

if (selected.length > 0 && !DRY) {
  const pkgPath = path.join(dest, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  const envLines = [];
  const readmeParts = [];

  // **`transpilePackages` は触らなくてよい。**
  // `crud-template` の `next.config.mjs` は **`package.json` の依存から
  // 自動生成**する作りになっている(「手書きは必ず漏れる」という判断)。
  // ここで依存を足せば、そのまま反映される——
  // **2026-08 に手で足す処理を書きかけて、不要と分かった**。
  for (const f of selected) {
    for (const d of f.deps) {
      if (pkg.dependencies[d] === undefined) pkg.dependencies[d] = "workspace:*";
    }
    if (f.env.length > 0) envLines.push("", ...f.env);
    readmeParts.push(f.readme);
    for (const [rel, make] of Object.entries(f.files)) {
      const target = path.join(dest, rel);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, make());
    }
  }

  pkg.dependencies = Object.fromEntries(Object.entries(pkg.dependencies).sort());
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  // **`env.ts` の schema にも足す。** `.env.example` だけ足しても、
  // **読み込み側が無ければ `serverEnv.X` は `undefined`** になる
  // ——2026-08 に実際そうなった(型は通るが実行時に落ちる)。
  const schemaLines = selected.flatMap((f) => f.envSchema ?? []);
  if (schemaLines.length > 0) {
    const envTsPath = path.join(dest, "src/server/env.ts");
    const envTs = await readFile(envTsPath, "utf8");
    // **`z.object({` の直後**に足す(既存の項目を壊さない)
    const marker = "  z.object({\n";
    const at = envTs.indexOf(marker);
    if (at >= 0) {
      const insertAt = at + marker.length;
      await writeFile(envTsPath, `${envTs.slice(0, insertAt)}${schemaLines.join("\n")}\n${envTs.slice(insertAt)}`);
    }
  }

  if (envLines.length > 0) {
    const envPath = path.join(dest, ".env.example");
    const cur = await readFile(envPath, "utf8");
    await writeFile(envPath, `${cur.trimEnd()}\n${envLines.join("\n")}\n`);
  }

  const readmePath = path.join(dest, "README.md");
  const curReadme = await readFile(readmePath, "utf8");
  await writeFile(readmePath, `${curReadme.trimEnd()}\n\n---\n\n${readmeParts.join("\n---\n\n")}`);

  console.log("");
  console.log(`  入れた機能: ${selected.map((f) => f.label).join(" / ")}`);
  console.log("  使い方は README.md の末尾に足してあります。");
}

console.log("");
console.log(`✅ apps/${name} を作りました`);
console.log("");
console.log("  次にやること:");
console.log("    pnpm install                      # 依存を解決する");
// **`pnpm gen:all` を最初に案内する。**
// 資料や索引は**アプリの一覧から自動生成**しているので、
// 作っただけだと生成物が古いままになり、**`pnpm check` が落ちます**
// ——「作った直後に赤い」のは、いちばん心が折れる形(2026-08 に確認)。
console.log("    pnpm gen:all                      # 資料・索引を作り直す(これをしないと pnpm check が落ちます)");
console.log(`    cp apps/${name}/.env.example apps/${name}/.env`);
console.log(`    pnpm db push ${name}              # スキーマを反映`);
console.log(`    pnpm dev:${name}                  # http://localhost:${port}`);
console.log("");
console.log(`  そのあと apps/${name}/README.md を見て、モデルと画面を差し替えてください。`);
