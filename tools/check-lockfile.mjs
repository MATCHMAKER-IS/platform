/**
 * **pnpm-lock.yaml が全 package.json と一致しているか**をオフラインで検査する。
 *   node tools/check-lockfile.mjs
 *
 * 【なぜ必要か】
 * 2026-07、Amplify のデプロイが preBuild の
 *   `pnpm install --frozen-lockfile --node-linker=hoisted`
 * で落ちた(ERR_PNPM_OUTDATED_LOCKFILE)。原因は、tailwindcss を
 * package.json に足したあと `pnpm install` を回さず、古い lockfile を
 * コミットしていたこと。**ローカルは通るのに CI だけ落ちる**、この基盤が
 * 最も潰したい型の穴だった:
 *   - ローカルの `pnpm install` は frozen ではないので、ズレを黙って埋める
 *   - CI は `--frozen-lockfile` が既定 true なので、ズレを厳格に拒否する
 * 結果、手元で気づけないまま push → デプロイで初めて発覚する。
 *
 * この検査は `pnpm install --frozen-lockfile` の**判定部分だけ**を、
 * ネットワーク無しで先取りする(specifier の突き合わせのみ。依存解決はしない)。
 * これが緑なら CI の同じ行も通る。赤なら「`pnpm install` して lockfile をコミット」。
 *
 * 【簡易であることの明示】
 * lockfile v9 の各 importer が持つ `specifier:` と、対応する package.json の
 * dependencies/devDependencies/optionalDependencies を文字列比較する。
 * peerDependencies やバージョン解決の細部までは見ない(それは pnpm 本体の仕事)。
 * ただし ERR_PNPM_OUTDATED_LOCKFILE の実際の原因の大半——
 * 「依存を足した/消した/バージョン表記を変えたのに lockfile を再生成していない」——は
 * これで捕まえられる。
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LOCK = path.join(ROOT, "pnpm-lock.yaml");

if (!existsSync(LOCK)) {
  console.error("❌ pnpm-lock.yaml が見つかりません");
  process.exit(1);
}

/** lockfile の importers セクションを {importerPath: {depName: specifier}} に読む。 */
function parseLockImporters(text) {
  const out = {};
  const lines = text.split("\n");
  let i = 0;
  // importers: まで進む
  while (i < lines.length && lines[i] !== "importers:") i += 1;
  i += 1;
  let cur = null; // 現在の importer パス
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === "" ) continue;
    if (/^[a-z]/.test(line)) break; // 次のトップセクション(packages: など)
    // importer 見出し: 2スペース + パス + ':'
    const mImp = line.match(/^ {2}(\S.*?):\s*$/);
    if (mImp) { cur = mImp[1].replace(/^['"]|['"]$/g, ""); out[cur] = {}; continue; }
    // 依存名: 6スペース + 名前 + ':'、直後の行が specifier:
    const mDep = line.match(/^ {6}('?[^:\s].*?'?):\s*$/);
    if (mDep && cur) {
      const name = mDep[1].replace(/^['"]|['"]$/g, "");
      const next = lines[i + 1] ?? "";
      const mSpec = next.match(/^\s+specifier:\s*(.+?)\s*$/);
      if (mSpec) out[cur][name] = mSpec[1].replace(/^['"]|['"]$/g, "");
    }
  }
  return out;
}

/**
 * package.json の依存を {deps, peers} に分けて返す(いずれも {name: specifier})。
 *
 * **peer を `deps` に混ぜてはいけない**。lockfile の importer は「package.json が
 * 直接宣言した依存」を持つ場所なので、peer をそこに要求すると「lockfile に無い」と
 * 誤検知する(例: packages/ui の react)。
 *
 * **かといって peer を捨ててもいけない**。この基盤の `.npmrc` は
 * `auto-install-peers=true` を使っており、pnpm は**自動導入した peer を importer 側に
 * 書き戻す**(実例: packages/image の `sharp` が peer レンジ `^0.33.0` のまま
 * dependencies に載る)。捨てると今度は逆向きの照合で「package.json から消えた依存」
 * として毎回引っかかり、**`pnpm install` を何度回しても緑にならない検査**になる。
 * 実際に 2026-07 の導入直後、react / react-dom / sharp / tesseract.js の 4 種 5 件が
 * この形で誤検知した(いずれも dependencies から peerDependencies へ移しただけ)。
 *
 * そこで peer は「lockfile に載っていてもよいが、載るなら指定は一致していること」
 * という緩い扱いにする。
 */
function readPkgDeps(pkgPath) {
  const p = JSON.parse(readFileSync(pkgPath, "utf8"));
  return {
    deps: {
      ...(p.dependencies ?? {}),
      ...(p.devDependencies ?? {}),
      ...(p.optionalDependencies ?? {}),
    },
    peers: { ...(p.peerDependencies ?? {}) },
  };
}

const lockImporters = parseLockImporters(readFileSync(LOCK, "utf8"));

// ワークスペースの全 package.json を集める(ルート + 各 importer)。
// `find` は Windows で別コマンドになるため使わない(tools/lib/collect-files.mjs 参照)
const pkgFiles = collectFiles(["."], ROOT, { extensions: ["package.json"], maxDepth: 3 })
  .filter((f) => f === "package.json" || f.endsWith("/package.json"));

const problems = [];
for (const rel of pkgFiles) {
  const dir = path.dirname(rel).replace(/^\.\/?/, "") || ".";
  const importerKey = dir === "" ? "." : dir;
  const { deps: pkgDeps, peers: pkgPeers } = readPkgDeps(path.join(ROOT, rel));
  const lockDeps = lockImporters[importerKey];

  if (lockDeps === undefined) {
    // package.json はあるが lockfile に importer が無い = 新規パッケージ未反映
    if (Object.keys(pkgDeps).length > 0) {
      problems.push(`${importerKey}: lockfile にこのパッケージの記載がありません(新規追加後に pnpm install していない可能性)`);
    }
    continue;
  }

  for (const [name, spec] of Object.entries(pkgDeps)) {
    // workspace:* などの内部依存は specifier がそのまま入る。欠落と不一致だけ見る。
    if (!(name in lockDeps)) {
      problems.push(`${importerKey}: "${name}": "${spec}" が lockfile にありません(依存を足したが pnpm install していない)`);
    } else if (lockDeps[name] !== spec) {
      problems.push(`${importerKey}: "${name}" のバージョン指定がズレ(package.json: ${spec} / lockfile: ${lockDeps[name]})`);
    }
  }
  for (const [name, lockSpec] of Object.entries(lockDeps)) {
    if (name in pkgDeps) continue;
    if (name in pkgPeers) {
      // auto-install-peers が書き戻したもの。載っていること自体は正常なので、
      // **指定がずれたときだけ**報告する(peer レンジを変えたのに未 install のケース)。
      if (lockSpec !== pkgPeers[name]) {
        problems.push(`${importerKey}: "${name}" は peerDependencies だが指定がズレ(package.json: ${pkgPeers[name]} / lockfile: ${lockSpec})`);
      }
      continue;
    }
    problems.push(`${importerKey}: "${name}" は lockfile に残っているが package.json から消えています(依存を外したが pnpm install していない)`);
  }
}

if (problems.length > 0) {
  // 種類ごとに集計してから出す(数百件を全部並べると、かえって読まれない)。
  const missingImporter = problems.filter((p) => p.includes("lockfile にこのパッケージの記載がありません"));
  const missingDep = problems.filter((p) => p.includes("が lockfile にありません"));
  const staleDep = problems.filter((p) => p.includes("package.json から消えています"));
  const versionDrift = problems.filter((p) => p.includes("バージョン指定がズレ"));

  console.error("❌ pnpm-lock.yaml が package.json と一致していません。**この状態は CI(Amplify)の frozen-lockfile で必ず落ちます**。");
  console.error(`\n   内訳(計 ${problems.length} 件):`);
  if (missingImporter.length) console.error(`   - lockfile 未記載のパッケージ: ${missingImporter.length} 件(新規追加後 pnpm install していない)`);
  if (missingDep.length) console.error(`   - lockfile に無い依存: ${missingDep.length} 件(依存を足したが未 install)`);
  if (staleDep.length) console.error(`   - lockfile に残る古い依存: ${staleDep.length} 件(依存を外したが未 install)`);
  if (versionDrift.length) console.error(`   - バージョン指定のズレ: ${versionDrift.length} 件`);
  console.error("\n   例(先頭 8 件):");
  for (const p of problems.slice(0, 8)) console.error("     - " + p);
  if (problems.length > 8) console.error(`     …ほか ${problems.length - 8} 件(--verbose で全件)`);

  if (process.argv.includes("--verbose")) {
    console.error("\n   全件:");
    for (const p of problems) console.error("     - " + p);
  }

  console.error("\n👉 直し方: リポジトリのルートで `pnpm install` を実行し、更新された pnpm-lock.yaml をコミットしてください。");
  console.error("   確認: `pnpm install --frozen-lockfile` がローカルで通れば CI も通ります。");
  process.exitCode = 1;
} else {
  const n = Object.keys(lockImporters).length;
  console.log(`✅ pnpm-lock.yaml は package.json と一致(${n} パッケージの依存指定を照合)。CI の frozen-lockfile を通ります`);
}
