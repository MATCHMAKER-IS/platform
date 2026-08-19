#!/usr/bin/env node
/**
 * **Next.js のメジャー版が、置き先（AWS Amplify）の対応範囲に収まっているか**を見る。
 *
 * ```bash
 * node tools/check-next-version.mjs
 * ```
 *
 * 【なぜ要るか】
 * AWS Amplify Hosting compute が対応するのは **Next.js 12〜15** です
 * （2026-08 時点。`docs/adr/0025-nextjs-15.md`）。16 は対応外です。
 *
 * ここが厄介なのは——
 *
 * > **手元では Next 16 でも動きます。**
 *
 * `pnpm dev` も `next build` も通ります。**気づくのは Amplify に上げたとき**で、
 * そのときには「なぜか本番だけ動かない」を追うことになります。
 * `pnpm up --latest` のような何気ない操作で上がってしまうので、
 * **人の注意ではなく検査で止めます**。
 *
 * 【上げたくなったら】
 * まず Amplify の対応状況を確かめ、`ADR-0025` を書き換えてから
 * このファイルの `MAX_MAJOR` を上げてください。**順番が逆になると、
 * 「なぜ 16 にしたのか」が誰にも分からなくなります**。
 *
 * @packageDocumentation
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Amplify Hosting compute が対応する上限。**上げる前に ADR-0025 を更新すること。** */
const MAX_MAJOR = 15;
/** 下限。**Amplify compute は 11 以前を扱えない**（Classic 扱いになる）。 */
const MIN_MAJOR = 12;

/**
 * `"^15.5.21"` のような指定から**メジャー版**を取り出す。
 *
 * `*` や `latest` のような**上限の無い指定は別扱い**にする——
 * 数字が読めないから通す、では検査の意味が無い。
 *
 * @param range package.json に書かれた版の指定
 * @returns メジャー版。読めなければ null
 */
function majorOf(range) {
  const m = /(\d+)\./.exec(String(range).replace(/^[\^~>=<\s]+/, ""));
  return m ? Number(m[1]) : null;
}

const problems = [];
const appsDir = path.join(ROOT, "apps");
let checked = 0;

for (const name of existsSync(appsDir) ? readdirSync(appsDir) : []) {
  const pkgPath = path.join(appsDir, name, "package.json");
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const range = pkg.dependencies?.next ?? pkg.devDependencies?.next;
  if (range === undefined) continue;
  checked += 1;

  const major = majorOf(range);
  if (major === null) {
    problems.push(
      `apps/${name}: next の版が読めません（"${range}"）`
      + "\n     → 上限の無い指定は、ある日いきなり Next 16 に上がります。\"^15.5.21\" のように書いてください",
    );
    continue;
  }
  if (major > MAX_MAJOR) {
    problems.push(
      `apps/${name}: next が ${major} 系です（"${range}"）`
      + `\n     → AWS Amplify Hosting compute の対応は ${MIN_MAJOR}〜${MAX_MAJOR} です。**手元では動くので気づけません**`
      + "\n     → 上げるなら先に Amplify の対応状況を確認し、docs/adr/0025-nextjs-15.md を書き換えてください",
    );
  } else if (major < MIN_MAJOR) {
    problems.push(
      `apps/${name}: next が ${major} 系です（"${range}"）`
      + `\n     → Amplify Hosting compute は ${MIN_MAJOR} 以降しか扱えません（それ以前は Classic 扱い）`,
    );
  }
}

if (problems.length > 0) {
  console.error(`\n❌ Next.js の版が置き先の対応範囲から外れています（${problems.length} 件）`);
  for (const p of problems) console.error(`   ${p}`);
  process.exit(1);
}

console.log(`✅ Next.js の版は Amplify の対応範囲内です（${MIN_MAJOR}〜${MAX_MAJOR} / ${checked} アプリ検査）`);
