#!/usr/bin/env node
/**
 * **前の版へ戻せる状態か**を見る。
 *
 * 【なぜ要るか】
 * `docker-compose.prod.yml` が
 *
 * ```yaml
 * image: ghcr.io/OWNER/REPO/internal-app:main
 * ```
 *
 * のように**タグを固定していると、戻す手段がありません**。
 * 壊れた版を出した直後に `pull` で取れるのは**壊れた最新**だからです。
 *
 * 2026-08 まで `INCIDENT_RESPONSE.md` には
 * 「前回の成功したデプロイを **Re-run**」と書いてありましたが、
 * **それでは戻りません**——同じ手順をもう一度実行するだけです。
 * もう一方の `git revert` は再ビルドが要り、**障害の最中に数分待つ**ことになります。
 *
 * **障害の最中に手順が無いことに気づく**のが、いちばん高くつきます。
 *
 * 【見るもの】
 *
 * | | なぜ |
 * |---|---|
 * | compose のタグが `${IMAGE_TAG…}` で差し替えられるか | 固定だと戻せない |
 * | **app と migrate が同じタグを使うか** | 片方だけ最新だと、**戻した版が知らない列**を前提に動く |
 * | release が `type=sha` でタグを付けるか | 戻す先が無ければ、変数にしても意味がない |
 * | 手順に切り戻しが書いてあるか | 覚えている人がいない前提で書く |
 *
 * 実行: node tools/check-rollback-ready.mjs
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const problems = [];
let scanned = 0;

// ---- 1. compose のタグが差し替えられるか ----
const composes = readdirSync(ROOT).filter((f) => /^docker-compose.*\.yml$/.test(f));
for (const file of composes) {
  const full = path.join(ROOT, file);
  const body = readFileSync(full, "utf8").replace(/\r\n/g, "\n");
  // ローカル開発用(ghcr のイメージを使わない)は対象外
  if (!body.includes("ghcr.io/")) continue;
  scanned += 1;

  const tags = [];
  for (const [i, line] of body.split("\n").entries()) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(/image:\s*(ghcr\.io\/\S+)/);
    if (m === null) continue;
    const image = m[1];
    tags.push({ line: i + 1, image });
    if (!image.includes("${")) {
      problems.push({
        where: `${file}:${i + 1}`,
        what: `タグが固定されています(${image})`,
        why: "壊れた版を出すと、pull で取れるのが壊れた最新になり、戻す手段がなくなります",
      });
    }
  }

  // **app と migrate が同じ変数を使っているか。**
  // 片方だけ固定だと、アプリを戻してもスキーマ適用は最新のまま
  const vars = new Set(
    tags.map((t) => (t.image.match(/\$\{([A-Z_]+)/) ?? [])[1]).filter((v) => v !== undefined),
  );
  if (tags.length > 1 && vars.size > 1) {
    problems.push({
      where: file,
      what: `イメージごとに違う変数を使っています(${[...vars].join(", ")})`,
      why: "アプリだけ戻してスキーマ適用が最新のままだと、戻した版が知らない列を前提に動きます",
    });
  }
}

// ---- 2. 戻す先のタグが作られているか ----
const release = path.join(ROOT, ".github", "workflows", "release.yml");
if (existsSync(release)) {
  scanned += 1;
  const body = readFileSync(release, "utf8");
  const shaTags = (body.match(/type=sha/g) ?? []).length;
  const images = (body.match(/^\s*images:\s/gm) ?? []).length;
  if (shaTags === 0) {
    problems.push({
      where: ".github/workflows/release.yml",
      what: "`type=sha` のタグを付けていません",
      why: "戻す先の版が存在しないので、compose を変数にしても戻せません",
    });
  } else if (images > shaTags) {
    problems.push({
      where: ".github/workflows/release.yml",
      what: `sha タグが一部のイメージにしか付いていません(images ${images} / type=sha ${shaTags})`,
      why: "sha の無いイメージは戻せません(app だけ戻して migrate が戻らない、が起きます)",
    });
  }
}

// ---- 3. 手順に書いてあるか ----
const runbook = path.join(ROOT, "docs", "ops", "INCIDENT_RESPONSE.md");
if (existsSync(runbook)) {
  scanned += 1;
  const body = readFileSync(runbook, "utf8");
  if (!body.includes("IMAGE_TAG")) {
    problems.push({
      where: "docs/ops/INCIDENT_RESPONSE.md",
      what: "切り戻しの手順に `IMAGE_TAG` の使い方が書かれていません",
      why: "障害の最中に、覚えている人がいるとは限りません",
    });
  }
}

if (problems.length === 0) {
  console.log(`✅ 前の版へ戻せる状態です(${scanned} ファイルを検査 / compose ${composes.length} 件)`);
  process.exit(0);
}

console.error(`❌ 前の版へ戻せません(${problems.length} 件 / ${scanned} ファイルを検査):`);
for (const p of problems) {
  console.error(`   ${p.where}: ${p.what}`);
  console.error(`     → ${p.why}`);
}
console.error("");
console.error("   compose のタグは差し替えられる形にしてください:");
console.error("     image: ghcr.io/OWNER/REPO/internal-app:${IMAGE_TAG:-main}");
console.error("");
console.error("   これで切り戻しが 1 行になります:");
console.error("     IMAGE_TAG=sha-abc1234 docker compose -f docker-compose.prod.yml up -d app");
process.exit(1);
