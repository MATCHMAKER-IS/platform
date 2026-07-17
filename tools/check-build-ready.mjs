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
 * - L: Tailwind 4 の予約 CSS 変数(--spacing 等)を基盤が上書きしていないか
 * - M: 統合デモサイトの nav に href の重複 / リンク切れが無いか
 * - N: パッケージが相手のバレルに無い名前を import していないか(TS2305)
 * - O: 入力系コントロールの高さが 10 ファイルで揃っているか
 * - P: showcase が未宣言のパッケージを直接 import していないか(Module not found)
 * - R: 同名だが中身の違う公開型が複数パッケージにないか(`--types` で表示)
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
    // **行頭が `import` の文だけ**を本物とみなす。複数行にまたがる場合は
    // 行頭の `}` または `} from "..."` までを 1 文として取る。
    //   - <pre> に載せたサンプルの import は JSX の中でインデントされているので拾わない
    //   - 1 行版と複数行版の両方を拾う(片方だけだと取りこぼす。実際にやらかした)
    const lines = src.split("\n");
    const statements = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (!/^import\s/.test(lines[i] ?? "")) continue;
      let stmt = lines[i] ?? "";
      // `from "..."` で閉じていなければ、行頭 `}` が出るまで足す
      while (i + 1 < lines.length && !/from\s*"[^"]+"\s*;?\s*$/.test(stmt)) {
        i += 1;
        stmt += "\n" + (lines[i] ?? "");
      }
      statements.push(stmt);
    }
    // 使用判定は「import 文を除いた残り全部」
    const body = src.split("\n").filter((l, i) => {
      const joined = statements.join("\n");
      return !joined.includes(l) || !/^\s*(import\s|type\s|\w+,?$|\}\s*from)/.test(l);
    }).join("\n");
    for (const stmt of statements) {
      const m = /import\s*\{([\s\S]*?)\}\s*from\s*"[^"]+"/.exec(stmt);
      if (!m) continue;
      for (const raw of (m[1] ?? "").split(",")) {
        const item = raw.trim();
        if (!item) continue;
        const name = item.replace(/^type\s+/, "").split(" as ").pop().trim();
        if (!name || !/^[A-Za-z_$][\w$]*$/.test(name)) continue;
        // import 文そのものを除いた本文で使われているか
        const rest = src.replace(stmt, "");
        if (!new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`).test(rest)) {
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

  // ── L: Tailwind CSS 4 の予約 CSS 変数を基盤が上書きしていないか ──
  // Tailwind 4 はユーティリティを `calc(var(--spacing) * N)` のように解決する。
  // @platform/theme が同名の変数を <html> に流し込むと、**Tailwind のクラスが全部歪む**。
  // 実際に `--spacing: 8px` でボタンが h-10=40px → 80px になった(スキンごとに倍率が変わる)。
  // 見た目の問題なので型検査でもテストでも捕まらない。ここで名前だけを見る。
  {
    // 「値を差し替えるだけ」の変数(--font-sans / --radius-lg など)は上書きして良い。
    // むしろ Tailwind 4 の推奨カスタマイズ方法。危険なのは以下の 2 種類だけ:
    //   --spacing … 間隔ユーティリティの「倍率の基準」。壊れ方が全体に及ぶ
    //   --tw-*    … Tailwind の内部変数
    const RESERVED = [["--spacing", true], ["--tw-", false]];
    for (const f of collect(path.join(ROOT, "packages"), [".ts", ".css"])) {
      const s = readFileSync(f, "utf8");
      for (const [name, exact] of RESERVED) {
        // CSS 変数を「書いている」箇所だけを見る(参照 var(--x) は問題ない)。
        // exact=true は完全一致(--spacing-4 のような名前空間は正当なので拾わない)。
        const tail = exact ? "" : "[\\w-]*";
        const re = new RegExp(`["'\`]${name}${tail}["'\`]\\s*\\]?\\s*=|^\\s*${name}${tail}\\s*:`, "m");
        if (!re.test(s)) continue;
        issues.push(
          `[L] ${path.relative(ROOT, f)}: Tailwind 4 の予約変数 ${name} を定義している` +
          ` — ユーティリティの倍率基準なので、上書きすると Tailwind のクラスが全部歪む。別名にすること(例: --spacing → --space)`,
        );
      }
    }
  }

  // ── M: 統合デモサイトの nav が壊れていないか(href の重複 / リンク切れ) ──
  // href が重複すると、サイドバーで 2 件が同時に「現在地」になり、
  // 片方を押してももう片方へ飛ぶ(実際に「掲示板」を押すとダッシュボードが出た)。
  // 実体の無い href はリンク切れだが、重複していると別ページに吸い込まれて気づけない。
  {
    const navFile = path.join(SITE, "src/lib/nav.ts");
    if (existsSync(navFile)) {
      const src = readFileSync(navFile, "utf8");
      const entries = [...src.matchAll(/\{\s*href:\s*"([^"]+)",\s*title:\s*"([^"]+)"/g)].map((m) => ({ href: m[1], title: m[2] }));
      const seen = new Map();
      for (const e of entries) {
        const prev = seen.get(e.href);
        if (prev) issues.push(`[M] nav.ts: href "${e.href}" が重複(「${prev}」と「${e.title}」) — サイドバーで両方が現在地になり、別ページへ飛ぶ`);
        else seen.set(e.href, e.title);
      }
      const appDir = path.join(SITE, "src/app");
      for (const e of entries) {
        const rel = e.href === "/" ? "" : e.href.replace(/^\//, "");
        if (!existsSync(path.join(appDir, rel, "page.tsx"))) {
          issues.push(`[M] nav.ts: "${e.title}" の href "${e.href}" にページが無い(リンク切れ)`);
        }
      }
    }
  }

  // ── N: パッケージが「相手のバレルに無い名前」を import していないか ──
  // @platform/quote が `import { type Rounding } from "@platform/invoice"` と書いていたが、
  // invoice のバレルは Rounding を出しておらず(実装元は @platform/tax)、TS2305 で落ちた。
  // 検査 K は「戻り値の型」しか見ないので、この形(引数の型・任意の named import)は素通りする。
  // showcase に足すまで Next のビルドに含まれないため、長く潜伏しうる。
  {
    const barrelExports = new Map(); // pkg 名 → Set<公開名>
    const declared = (src) => {
      const out = new Set();
      for (const m of src.matchAll(/^\s*export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|abstract\s+class|interface|type|enum)\s+(\w+)/gm)) out.add(m[1]);
      // `export { A, type B }` と `export type { C }` の両方を拾う
      for (const m of src.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
        for (const raw of (m[1] ?? "").split(",")) {
          const n = raw.trim().replace(/^type\s+/, "").split(" as ").pop()?.trim();
          if (n) out.add(n);
        }
      }
      return out;
    };
    const resolveTs = (from, spec) => {
      const t = path.resolve(path.dirname(from), spec);
      for (const c of [`${t}.ts`, `${t}.tsx`, path.join(t, "index.ts")]) if (existsSync(c)) return c;
      return null;
    };
    // 各パッケージのバレルが公開する名前(export * from も 1 段だけ辿る)
    for (const barrel of collect(path.join(ROOT, "packages"), [".ts"]).filter((f) => f.endsWith("src/index.ts"))) {
      const pkg = path.relative(path.join(ROOT, "packages"), barrel).split(path.sep)[0];
      const src = readFileSync(barrel, "utf8");
      const names = declared(src);
      for (const m of src.matchAll(/export\s+(?:type\s+)?\*\s*from\s*"(\.[^"]+)"/g)) {
        const t = resolveTs(barrel, m[1]);
        if (t) for (const n of declared(readFileSync(t, "utf8"))) names.add(n);
      }
      // `export * from "@platform/x"` のような他パッケージ丸ごと再 export があれば、判定不能なので諦める
      if (/export\s+(?:type\s+)?\*\s*from\s*"@platform\//.test(src)) names.add("*");
      barrelExports.set(`@platform/${pkg}`, names);
    }
    // 各パッケージの import を突き合わせる
    for (const f of collect(path.join(ROOT, "packages"), [".ts", ".tsx"])) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"(@platform\/[\w-]+)"/g)) {
        const target = barrelExports.get(m[2]);
        if (!target || target.size === 0 || target.has("*")) continue;
        for (const raw of (m[1] ?? "").split(",")) {
          const name = raw.trim().replace(/^type\s+/, "").split(" as ")[0]?.trim();
          if (!name || target.has(name)) continue;
          issues.push(
            `[N] ${path.relative(ROOT, f)}: ${m[2]} は "${name}" を export していない` +
            ` — TS2305 になる。実装元から再 export するか、実装元パッケージから直接 import すること`,
          );
        }
      }
    }
  }

  // ── O: 入力系コントロールの高さが揃っているか ──
  // 「入力欄の高さ」は 1 つの決定なのに、h-9 が 10 ファイルにベタ書きされている。
  // 揃っていないと、Input の隣に Button を置いたときに段差ができる(見た目の問題なので
  // 型検査でもテストでも捕まらない)。値を変えるときは全部を一緒に変えること。
  {
    const CONTROL_H = "h-9"; // 入力系コントロールの標準の高さ(36px)
    const files = [
      "autocomplete.tsx", "color-picker.tsx", "combobox.tsx", "date-picker.tsx",
      "email-login-form.tsx", "input.tsx", "number-input.tsx", "password-input.tsx",
      "search-input.tsx", "button.tsx",
    ];
    for (const name of files) {
      const f = path.join(ROOT, "packages/ui/src/components", name);
      if (!existsSync(f)) continue;
      const src = readFileSync(f, "utf8");
      if (!src.includes(CONTROL_H)) {
        issues.push(
          `[O] packages/ui/src/components/${name}: 入力系コントロールの標準の高さ ${CONTROL_H} が見当たらない` +
          ` — Input と Button で段差ができる。高さを変えるならこの ${files.length} ファイルを揃えて変えること`,
        );
      }
    }
  }

  // ── P: showcase が package.json に無いパッケージを import していないか ──
  // .npmrc が巻き上げを抑えているので、宣言していない依存は解決できず
  // `Module not found` で build が落ちる(実際に lucide-react でやらかした)。
  // dev では動くことがあるので気づきにくい。基盤経由で使うのが規約
  // (packages/ui/README.md「アプリは lucide を直接依存に持たない」)。
  {
    const pkgPath = path.join(SITE, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      const declared = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
      for (const f of collect(path.join(SITE, "src"))) {
        const src = readFileSync(f, "utf8");
        for (const m of src.matchAll(/^import\s[^\n]*?from\s*"([^"]+)"/gm)) {
          const spec = m[1] ?? "";
          if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("node:")) continue;
          // "@scope/name/sub" と "name/sub" の両方からパッケージ名を取る
          const parts = spec.split("/");
          const name = spec.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
          if (!name || declared.has(name)) continue;
          issues.push(
            `[P] ${path.relative(ROOT, f)}: "${name}" は demos/showcase/package.json に無い` +
            ` — .npmrc が巻き上げを抑えているので Module not found になる。基盤(@platform/*)経由で使うこと`,
          );
        }
      }
    }
  }

  // ── R: 同名だが中身の違う公開型が、複数パッケージにないか ──
  // @platform/audit と @platform/dencho の両方に ChainVerification があり、
  // brokenAt が `number | null` と `number | undefined` で違っていた。
  // **片方を見て書いたコードが、もう片方では型エラーになる**(実際にやらかした)。
  // 名前が同じで中身が違うのが危険。中身が同じなら実害は小さいので拾わない。
  const KNOWN_OK = new Set([
    // 各パッケージが独立に持つのが自然な汎用名(統合するとかえって依存が増える)
    "RetryOptions", "Attachment", "Money", "Result",
  ]);
  {
    const shapes = new Map(); // 型名 → [{ pkg, body }]
    for (const f of collect(path.join(ROOT, "packages"), [".ts"])) {
      const rel = path.relative(path.join(ROOT, "packages"), f);
      const pkg = rel.split(path.sep)[0];
      if (!pkg || f.includes(".test.")) continue;
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/export\s+interface\s+(\w+)\s*\{([^}]*)\}/g)) {
        const name = m[1];
        if (!name || KNOWN_OK.has(name)) continue;
        // コメントと空白を落として比較(表記ゆれで誤検知しないように)
        const body = (m[2] ?? "").replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").replace(/\s+/g, " ").trim();
        const list = shapes.get(name) ?? [];
        if (!list.some((x) => x.pkg === pkg)) list.push({ pkg, body });
        shapes.set(name, list);
      }
    }
    for (const [name, list] of shapes) {
      if (list.length < 2) continue;
      const bodies = new Set(list.map((x) => x.body));
      if (bodies.size < 2) continue; // 中身が同じなら実害は小さい
      const pkgs = list.map((x) => `@platform/${x.pkg}`).sort().join(" / ");
      // ビルドは止まらない(使う側が正しく書けば通る)ので、既定では警告に留める。
      // `node tools/check-build-ready.mjs --types` で一覧できる。
      if (process.argv.includes("--types")) {
        issues.push(
          `[R] 同名だが中身の違う公開型: ${name} (${pkgs})` +
          ` — 片方を見て書くともう片方で型エラーになる。名前を分けるか、片方へ寄せること`,
        );
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
