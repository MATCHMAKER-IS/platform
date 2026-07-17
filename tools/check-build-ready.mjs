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
 * - G: 構文エラー(引数リストに文が混入。過去の一括処理が壊した形)
 * - J: server → client へ関数を持つオブジェクト(create*() の戻り値)を渡していないか
 * - K: バレルが関数だけ出して戻り値の型を出していない(TS2742/TS2883)
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
    // **複数行にまたがる export ブロック**も拾う(1 行前提だと見逃す。
    // 実際に charts の Gauge / Histogram を見逃してビルドが落ちた)
    const seen = new Map();
    const body = readFileSync(idx, "utf8");
    for (const m of body.matchAll(/export\s*\{([^}]*)\}\s*from\s*"([^"]+)"/gs)) {
      const line = body.slice(0, m.index).split("\n").length;
      for (const raw of (m[1] ?? "").split(",")) {
        const item = raw.trim();
        if (!item) continue;
        const pub = item.split(" as ").pop().replace(/^type\s+/, "").trim();
        if (!pub || !/^[A-Za-z_$][\w$]*$/.test(pub)) continue;
        if (seen.has(pub)) issues.push(`[B] ${name}/src/index.ts: ${pub} が重複(行 ${seen.get(pub)} と ${line})`);
        else seen.set(pub, line);
      }
    }
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
          // Turbopack は .js → .ts を解決しない(実際に 336 件の Module not found が出た)。
          // moduleResolution: Bundler なので拡張子は不要。
          if (spec.endsWith(".js")) {
            issues.push(`[E] ${path.relative(ROOT, f)}: ${spec} — .js を外すこと(Turbopack が解決しない)`);
          } else if (!resolveRelative(f, spec)) {
            issues.push(`[E] ${path.relative(ROOT, f)}: ${spec}`);
          }
        }
      }
    }
  }

  // ── G: 構文エラー(引数リストに文が混入)──
  // 過去の一括処理が壊した形。tsc は通らないが、型検査を回さないと気づけない。
  // 実際に combobox.tsx / draggable-dashboard.tsx で
  // `export function X({ const t = useT(); options, ... })` になっていた。
  for (const dir of [path.join(ROOT, "packages"), path.join(ROOT, "apps"), path.join(ROOT, "demos")]) {
    for (const f of collect(dir)) {
      const lines = readFileSync(f, "utf8").split("\n");
      let inParams = false;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (/^\s*export\s+(?:default\s+)?function\s+\w+\s*\(\s*\{\s*$/.test(l)) { inParams = true; continue; }
        if (!inParams) continue;
        if (/^\s*\}[:)]/.test(l)) { inParams = false; continue; }
        if (/^\s*(const|let|var|return|if|for)\s/.test(l)) {
          issues.push(`[G] ${path.relative(ROOT, f)}:${i + 1}: 引数リストに文が混入(${l.trim().slice(0, 40)})`);
          inParams = false;
        }
      }
    }
  }

  // ── H: Icon の name はパスカルケース(lucide-react の名前)──
  // ケバブケース("trending-up")は古い記法。lucide-react は "TrendingUp" を期待する。
  // 型検査でしか気づけない(shim では any になるため、この検査で補う)。
  for (const dir of [path.join(ROOT, "demos"), path.join(ROOT, "apps")]) {
    for (const f of collect(dir, [".tsx"])) {
      const s = readFileSync(f, "utf8");
      for (const m of s.matchAll(/<Icon\s+name="([a-z][\w-]*)"/g)) {
        issues.push(`[H] ${path.relative(ROOT, f)}: Icon name="${m[1]}" はケバブケース(パスカルケースにする)`);
      }
    }
  }

  // ── I: 未使用の import(noUnusedLocals: true なのでビルドが止まる)──
  for (const f of collect(path.join(SITE, "src"))) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"[^"]+"/g)) {
      const body = src.slice(m.index + m[0].length);
      for (const raw of (m[1] ?? "").split(",")) {
        const item = raw.trim();
        if (!item) continue;
        const name = item.replace(/^type\s+/, "").split(" as ").pop().trim();
        if (!name || !/^[A-Za-z_$][\w$]*$/.test(name)) continue;
        if (!new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`).test(body)) {
          issues.push(`[I] ${path.relative(ROOT, f)}: ${name} を import しているが使っていない(noUnusedLocals でビルドが止まる)`);
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

  // ── J: server から client へ「関数を持つオブジェクト」を渡していないか ──
  // create*() が返すレジストリ等はクロージャの塊。Server Component から Client Component へ
  // props で渡すと RSC のシリアライズを通れず、プリレンダで全ページが落ちる:
  //   Error: Functions cannot be passed directly to Client Components
  // dev では動き、next build で初めて出る(実際に Amplify で /_not-found が落ちた)。
  // 検出: create*() の戻り値に付いた名前が、"use client" の無いファイルで JSX の prop に渡されている。
  {
    // 1) create*() の戻り値に付いた export 名を集める(モジュール名 → 名前の集合)
    const factories = new Map(); // 絶対パス(拡張子なし) → Set<name>
    for (const dir of [path.join(ROOT, "packages"), path.join(ROOT, "apps"), path.join(ROOT, "demos")]) {
      for (const f of collect(dir)) {
        const s = readFileSync(f, "utf8");
        const names = new Set();
        for (const m of s.matchAll(/export\s+const\s+(\w+)\s*(?::[^=]+)?=\s*create[A-Z]\w*\s*\(/g)) names.add(m[1]);
        if (names.size > 0) factories.set(f.replace(/\.tsx?$/, ""), names);
      }
    }
    // 2) "use client" の無い .tsx が、その名前を prop に渡していないか
    for (const dir of [path.join(ROOT, "apps"), path.join(ROOT, "demos")]) {
      for (const f of collect(dir, [".tsx"])) {
        const s = readFileSync(f, "utf8");
        if (s.trimStart().startsWith('"use client"')) continue; // client 同士なら問題ない
        const suspects = new Set();
        // 相対 import 経由
        for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*"(\.[^"]+)"/g)) {
          // resolveRelative は boolean を返すので、ここでは自前で解決する。
          // factories のキーは拡張子なしの絶対パス。
          const target = path.resolve(path.dirname(f), String(m[2])).replace(/\.(js|ts|tsx)$/, "");
          const exported = factories.get(target) ?? factories.get(path.join(target, "index"));
          if (!exported) continue;
          for (const raw of (m[1] ?? "").split(",")) {
            const name = raw.trim().replace(/^type\s+/, "").split(" as ").pop()?.trim();
            if (name && exported.has(name)) suspects.add(name);
          }
        }
        // 同一ファイル内で作っている場合
        for (const m of s.matchAll(/^\s*const\s+(\w+)\s*(?::[^=]+)?=\s*create[A-Z]\w*\s*\(/gm)) suspects.add(m[1]);
        for (const name of suspects) {
          if (new RegExp(`=\\{${name}\\}`).test(s)) {
            issues.push(
              `[J] ${path.relative(ROOT, f)}: ${name}(create*() の戻り値)を server から client へ prop で渡している` +
              ` — 関数は RSC 境界を越えられない。client 側で作るか、プレーンデータを渡すこと`,
            );
          }
        }
      }
    }
  }

  // ── K: バレルが「関数だけ出して戻り値の型を出していない」状態でないか ──
  // packages/*/package.json の exports は "." のみ。サブパスを名指しできないので、
  // 戻り値の型がバレルから出ていないと、利用側で型に名前を付けられずビルドが落ちる:
  //   TS2742/TS2883: The inferred type of 'x' cannot be named without a reference to ...
  // dev では動き、next build の型検査で初めて出る(Amplify で実際に落ちた)。
  {
    const BUILTIN = new Set(["void","string","number","boolean","Promise","Result","Record","Array",
      "Map","Set","unknown","any","never","null","undefined","object","Uint8Array","Date","RegExp",
      "AsyncGenerator","Generator","Iterable","AsyncIterable","ReadableStream","Response","Buffer",
      "URL","Error","Partial","Required","Pick","Omit","this"]);
    const declaredTypes = (src) =>
      new Set([...src.matchAll(/^\s*(?:export\s+)?(?:interface|type|class|enum)\s+(\w+)/gm)].map((m) => m[1]));
    const exportedTypes = (src) =>
      new Set([...src.matchAll(/^\s*export\s+(?:interface|type|class|enum)\s+(\w+)/gm)].map((m) => m[1]));
    const resolveTs = (from, spec) => {
      const t = path.resolve(path.dirname(from), spec);
      for (const c of [`${t}.ts`, `${t}.tsx`, path.join(t, "index.ts")]) if (existsSync(c)) return c;
      return null;
    };

    for (const barrel of collect(path.join(ROOT, "packages"), [".ts"]).filter((f) => f.endsWith("src/index.ts"))) {
      const bsrc = readFileSync(barrel, "utf8");
      const out = exportedTypes(bsrc);
      // export { A, type B, type C } の型名を「全部」拾う(1つ目だけでは取りこぼす)
      for (const m of bsrc.matchAll(/export\s*\{([^}]*)\}/g)) {
        for (const raw of (m[1] ?? "").split(",")) {
          const n = raw.trim();
          if (n.startsWith("type ")) out.add(n.slice(5).split(" as ").pop().trim());
        }
      }
      for (const m of bsrc.matchAll(/export\s*\*\s*from\s*"(\.[^"]+)"/g)) {
        const t = resolveTs(barrel, m[1]);
        if (t) for (const n of exportedTypes(readFileSync(t, "utf8"))) out.add(n);
      }
      for (const m of bsrc.matchAll(/export\s*\{([^}]*)\}\s*from\s*"(\.[^"]+)"/g)) {
        const target = resolveTs(barrel, m[2]);
        if (!target) continue;
        const tsrc = readFileSync(target, "utf8");
        const decl = declaredTypes(tsrc);
        for (const raw of (m[1] ?? "").split(",")) {
          const name = raw.trim();
          if (!name || name.startsWith("type ")) continue;
          const fn = name.split(" as ")[0].trim();
          const fm = new RegExp(`export\\s+function\\s+${fn}\\s*(?:<[^>]*>)?\\s*\\([^)]*\\)\\s*:\\s*([^{;]+)`, "s").exec(tsrc);
          if (!fm) continue;
          for (const id of new Set([...(fm[1] ?? "").matchAll(/\b([A-Z]\w*)/g)].map((x) => x[1]))) {
            if (BUILTIN.has(id) || !decl.has(id) || out.has(id)) continue;
            issues.push(
              `[K] ${path.relative(ROOT, barrel)}: ${fn}() の戻り値の型 ${id} がバレルから export されていない` +
              ` — 利用側で TS2742/TS2883 になる。\`export { ${fn}, type ${id} } from "..."\` にすること`,
            );
          }
        }
      }
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
