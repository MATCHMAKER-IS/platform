/**
 * **パッケージの成熟度(tier)が宣言されていて、依存の向きが正しいか**を検査する。
 *   node tools/check-package-tier.mjs
 *   node tools/check-package-tier.mjs --list
 *
 * 【なぜ必要か】
 * 119 パッケージが**すべて横並び**だと、使う側は
 * 「これは本番で使っていいのか」を**判断できない**。
 * 2026-08 の時点で、**実アプリから 1 度も使われていないパッケージが 24 件**あり、
 * 見た目は他の 95 件と区別が付かなかった。
 *
 * 区別が付かないと、次の 2 つが同時に起きる:
 *   - 使う側は**未検証のものを本番で掴む**
 *   - 直す側は**24 件すべてを本番品質で保守し続ける**(版上げ・脆弱性対応)
 *
 * 【tier の意味】
 *   stable      … 実アプリが使っている、または他の 2 パッケージ以上が依存している。
 *                 **公開 API を壊す変更には Changesets の major が要る。**
 *   incubating  … まだ実アプリでの使用実績が無い。**予告なく変わる。**
 *                 showcase での動作確認までは済んでいる。
 *   deprecated  … 廃止予定。新規利用禁止。**移行先を README の冒頭に書くこと。**
 *
 * 【守る不変条件】
 *   1. すべてのパッケージが `platform.tier` を宣言している
 *   2. **stable が incubating に依存しない**
 *      (安定と言いながら、足元が動くものの上に立たない)
 *   3. **stable が deprecated に依存しない**
 *
 * tier を上げるときは、実アプリで使ってから。**先に上げないこと**——
 * 「そのうち使う」で stable にすると、この検査は意味を失う。
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG_DIR = path.join(ROOT, "packages");

/** 有効な tier。 */
const TIERS = new Set(["stable", "incubating", "deprecated"]);

/** 各パッケージの package.json を読む。 */
function readPackages() {
  const out = new Map();
  for (const name of readdirSync(PKG_DIR)) {
    const fp = path.join(PKG_DIR, name, "package.json");
    if (!existsSync(fp)) continue;
    out.set(name, JSON.parse(readFileSync(fp, "utf8")));
  }
  return out;
}

/** `@platform/xxx` の依存先(devDependencies は含めない)を返す。 */
function platformDeps(pkg) {
  return Object.keys(pkg.dependencies ?? {})
    .filter((d) => d.startsWith("@platform/"))
    .map((d) => d.slice("@platform/".length));
}

export function check({ list = false } = {}) {
  const packages = readPackages();
  const tierOf = new Map();
  const issues = [];

  for (const [name, pkg] of packages) {
    const tier = pkg.platform?.tier;
    if (tier === undefined) {
      issues.push(`${name}: package.json に platform.tier がありません`);
      continue;
    }
    if (!TIERS.has(tier)) {
      issues.push(`${name}: platform.tier が不正です("${tier}" / 使えるのは ${[...TIERS].join(" / ")})`);
      continue;
    }
    tierOf.set(name, tier);
  }

  if (list) {
    const byTier = { stable: [], incubating: [], deprecated: [] };
    for (const [name, tier] of tierOf) byTier[tier].push(name);
    for (const tier of ["stable", "incubating", "deprecated"]) {
      console.log(`\n【${tier}】${byTier[tier].length} 件`);
      if (byTier[tier].length > 0) console.log("  " + byTier[tier].sort().join(" "));
    }
    return { ok: true };
  }

  for (const [name, pkg] of packages) {
    const tier = tierOf.get(name);
    if (tier !== "stable") continue;
    for (const dep of platformDeps(pkg)) {
      const depTier = tierOf.get(dep);
      if (depTier === "incubating" || depTier === "deprecated") {
        issues.push(
          `${name}(stable) が ${dep}(${depTier}) に依存しています` +
            `\n   → ${dep} を実アプリで使って stable に上げるか、${name} を incubating に下げてください`,
        );
      }
    }
  }

  if (issues.length > 0) {
    console.error(`❌ パッケージの成熟度に問題があります(${issues.length} 件):`);
    for (const i of issues) console.error(`   ${i}`);
    return { ok: false };
  }

  const counts = { stable: 0, incubating: 0, deprecated: 0 };
  for (const tier of tierOf.values()) counts[tier] += 1;
  console.log(
    `✅ 成熟度の宣言と依存の向きは正しい` +
      `(stable ${counts.stable} / incubating ${counts.incubating} / deprecated ${counts.deprecated})`,
  );
  return { ok: true };
}

// **`file://${process.argv[1]}` で比べない。** Windows では
// `import.meta.url` が `file:///C:/…`、`process.argv[1]` が `C:\…` になり、
// **一致しないので本体が動かない**(何も出力せず終わる。エラーも出ないので気づけない)。
// 2026-08、`node tools/check-coverage.mjs --set-floor` が Windows で無反応だった。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = check({ list: process.argv.includes("--list") });
  process.exit(r.ok ? 0 : 1);
}
