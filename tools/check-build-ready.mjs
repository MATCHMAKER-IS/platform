#!/usr/bin/env node
/**
 * `next build` が通る前提が揃っているかを検査する。
 *
 * **ローカルの `pnpm dev` では動くのに、`next build` で落ちる**類のバグを、
 * ビルドせずに機械的に見つける。実際に AWS Amplify で 7 回失敗し、
 * そのたびに 1 つずつ見つかった問題を、まとめて検査する。
 *
 * 検査:
 * - A: package.json の main / exports が実在するソースを指すか(dist はビルドしないと無い)
 * - B: index.ts に重複 export が無いか(Turbopack が落ちる。tsc は通る)
 * - C: フックを使う .tsx に "use client" があるか
 * - D: "use client" と metadata を同時に export していないか(Next の禁止事項)
 * - E: すべての import が解決できるか(@platform/* と相対 import)
 * - F: client から node: 専用のコードを import していないか
 *
 * 使い方: node tools/check-build-ready.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SITE = path.join(ROOT, "demos/showcase");

/** ディレクトリを再帰してソースを集める。 */
function collect(dir, exts = [".ts", ".tsx"]) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...collect(p, exts));
    else if (exts.some((e) => name.endsWith(e)) && !name.includes(".test.")) out.push(p);
  }
  return out;
}

/** パッケージのエントリ表を作る(name → 実ファイル)。 */
function buildEntryMap() {
  const map = new Map();
  const pkgsDir = path.join(ROOT, "packages");
  for (const name of readdirSync(pkgsDir)) {
    const pj = path.join(pkgsDir, name, "package.json");
    if (!existsSync(pj)) continue;
    const d = JSON.parse(readFileSync(pj, "utf8"));
    if (!d.name) continue;
    const base = path.join(pkgsDir, name);
    const ex = d.exports;
    if (ex && typeof ex === "object") {
      for (const [key, val] of Object.entries(ex)) {
        if (typeof val !== "string") continue;
        const spec = key === "." ? d.name : `${d.name}/${key.replace(/^\.\//, "")}`;
        map.set(spec, path.join(base, val.replace(/^\.\//, "")));
      }
    } else if (d.main) {
      map.set(d.name, path.join(base, String(d.main).replace(/^\.\//, "")));
    }
  }
  return map;
}

/** 相対 import を解決する(.js → .ts/.tsx も試す)。 */
function resolveRelative(from, spec) {
  const t = path.resolve(path.dirname(from), spec);
  const cands = [
    t, t.replace(/\.js$/, ".ts"), t.replace(/\.js$/, ".tsx"),
    `${t}.ts`, `${t}.tsx`,
    path.join(t, "index.ts"), path.join(t, "index.tsx"),
    t.replace(/\.js$/, "/index.ts"),
  ];
  return cands.some((c) => existsSync(c));
}

export function check() {
  const issues = [];
  const entries = buildEntryMap();

  // ── A: package.json のエントリ ──
  const pkgsDir = path.join(ROOT, "packages");
  for (const name of readdirSync(pkgsDir)) {
    const pj = path.join(pkgsDir, name, "package.json");
    if (!existsSync(pj)) continue;
    const d = JSON.parse(readFileSync(pj, "utf8"));
    const base = path.join(pkgsDir, name);
    if (d.main) {
      if (String(d.main).includes("dist")) {
        issues.push(`[A] ${name}: main が dist を指す(ビルドしないと存在しない)`);
      }
      if (!existsSync(path.join(base, String(d.main).replace(/^\.\//, "")))) {
        issues.push(`[A] ${name}: main の実体が無い(${d.main})`);
      }
    }
    if (d.exports && typeof d.exports === "object") {
      for (const [key, val] of Object.entries(d.exports)) {
        if (typeof val !== "string" || val.includes("tsconfig") || val.includes("vitest")) continue;
        if (!existsSync(path.join(base, val.replace(/^\.\//, "")))) {
          issues.push(`[A] ${name}: exports["${key}"] の実体が無い(${val})`);
        }
      }
    }
  }

  // ── B: index.ts の重複 export ──
  for (const name of readdirSync(pkgsDir)) {
    const idx = path.join(pkgsDir, name, "src/index.ts");
    if (!existsSync(idx)) continue;
    const seen = new Map();
    idx && readFileSync(idx, "utf8").split("\n").forEach((line, i) => {
      const m = /^export\s+\{([^}]*)\}\s+from\s+"/.exec(line);
      if (!m) return;
      for (const raw of (m[1] ?? "").split(",")) {
        const item = raw.trim();
        if (!item) continue;
        const pub = item.split(" as ").pop().replace(/^type\s+/, "").trim();
        if (!pub || !/^[A-Za-z_$][\w$]*$/.test(pub)) continue;
        if (seen.has(pub)) issues.push(`[B] ${name}/src/index.ts: ${pub} が重複(行 ${seen.get(pub)} と ${i + 1})`);
        else seen.set(pub, i + 1);
      }
    });
  }

  // ── C/D: use client ──
  const HOOKS = /\buse(State|Effect|Ref|Memo|Callback|Context|Reducer|LayoutEffect|ImperativeHandle)\b/;
  for (const dir of [path.join(ROOT, "packages"), path.join(ROOT, "demos")]) {
    for (const f of collect(dir, [".tsx"])) {
      const s = readFileSync(f, "utf8");
      const isClient = s.trimStart().startsWith('"use client"');
      if (HOOKS.test(s) && !isClient) {
        issues.push(`[C] ${path.relative(ROOT, f)}: フックを使うのに "use client" が無い`);
      }
      if (isClient && /export\s+const\s+metadata/.test(s)) {
        issues.push(`[D] ${path.relative(ROOT, f)}: "use client" なのに metadata を export`);
      }
    }
  }

  // ── E: import の解決 ──
  const sitePkg = JSON.parse(readFileSync(path.join(SITE, "package.json"), "utf8"));
  const deps = Object.keys(sitePkg.dependencies ?? {}).filter((k) => k.startsWith("@platform/"));
  const targets = [path.join(SITE, "src"), ...deps.map((d) => path.join(ROOT, "packages", d.split("/")[1], "src"))];
  for (const base of targets) {
    for (const f of collect(base)) {
      const s = readFileSync(f, "utf8");
      const specs = [
        ...[...s.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]),
        ...[...s.matchAll(/import\("([^"]+)"\)/g)].map((m) => m[1]),
      ];
      for (const spec of specs) {
        if (spec.startsWith("@platform/")) {
          const t = entries.get(spec);
          if (!t) issues.push(`[E] ${path.relative(ROOT, f)}: ${spec} が解決できない`);
          else if (!existsSync(t)) issues.push(`[E] ${path.relative(ROOT, f)}: ${spec} → 実体が無い`);
        } else if (spec.startsWith(".") && !spec.endsWith(".css")) {
          if (!resolveRelative(f, spec)) issues.push(`[E] ${path.relative(ROOT, f)}: ${spec}`);
        }
      }
    }
  }

  // ── F: client が node: を使う ──
  for (const f of collect(path.join(SITE, "src"))) {
    const s = readFileSync(f, "utf8");
    if (s.trimStart().startsWith('"use client"') && /from\s+"node:/.test(s)) {
      issues.push(`[F] ${path.relative(ROOT, f)}: "use client" なのに node: を import`);
    }
  }

  return issues;
}

const issues = check();
if (issues.length > 0) {
  for (const i of issues) console.error(`❌ ${i}`);
  console.error(`\n${issues.length} 件。next build が失敗します。`);
  process.exit(1);
}
console.log("✅ next build が通る前提は揃っています(エントリ/重複export/use client/import解決)");
