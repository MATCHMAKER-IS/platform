/**
 * **API が入力を検証しているか**を被覆率で検査する(下限ラチェット方式)。
 *   node tools/check-input-validation.mjs
 *   node tools/check-input-validation.mjs --list      … 検証していないルートを一覧
 *   node tools/check-input-validation.mjs --set-floor … 上がったら下限を引き上げる
 *
 * 【なぜ必要か】
 *
 * 2026-08 の点検で、`req.json()` を読む **110 本のうち 48 本(44%)が
 * 入力を一度も検証していなかった**。
 *
 * ```ts
 * const patch = (await req.json().catch(() => ({}))) as Record<string, string>;
 * await settingsStore.update(patch);   // ← 無検証
 * ```
 *
 * **`as Record<string, string>` は型の嘘である。** 実際には何でも入る。
 * TypeScript は境界の外から来る値を検査しないので、
 * **型検査が緑でも、実行時には想定外の値がそのまま奥まで届く**。
 *
 * さらに、基盤には `@platform/validation` の `validate(schema, input)` が
 * `Result` を返す形で用意され、日本固有のスキーマ(マイナンバー・法人番号・
 * 郵便番号・カナ)まで揃っている。**それが 229 本すべてで一度も呼ばれていなかった。**
 * 「部品はあるのに使われていない」の典型である(ADR 0024)。
 *
 * 代わりに 59 本が手書きで、次のような形をしていた:
 *
 * ```ts
 * if (typeof body.amount !== "number" || body.amount <= 0) …
 * ```
 *
 * 手書きが常に悪いわけではないが、**表記が揃わず、抜けても気づけない**。
 * 実際、金額を `Int` へ移行したとき、**手作業では 6 件中 2 件しか
 * 見つけられなかった**(整数検証の抜け)。
 *
 * 【何を「検証している」とみなすか】
 *
 *   1. `validate(...)` / `safeParse` / `z.object` を通している(**推奨**)
 *   2. `typeof body.x` / `Number.isSafeInteger` などの手書き(**可**)
 *   3. どちらも無い(**未検証**)
 *
 * 1 と 2 を分けて数える。**手書きを禁止はしない**——
 * 一気に置き換えると差分が大きくなりすぎ、レビューできない。
 * **未検証を減らすことが先**で、手書きから `validate` への移行はその後でよい。
 *
 * 【例外】
 *
 * 本文を使わないルート(トークンだけ見る webhook など)は
 * その場に `// no-body-validation: <理由>` を書く。
 */
import { readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FLOOR_FILE = path.join(ROOT, "tools", "input-validation-floor.json");

/** 本文を読んでいるか。 */
const READS_BODY = /await\s+req\.json\(\)|await\s+request\.json\(\)/;

/** 基盤の検証を通しているか(推奨形)。 */
const USES_SCHEMA = /\bvalidate\s*\(|\.safeParse\s*\(|\bz\.object\s*\(/;

/**
 * 手書きの検証(可)。
 *
 * **専用の検証関数も数える。** `crud-template` は `validateItemInput(body)` の形で
 * 検証しており、`typeof body.x` は現れない——**それを「未検証」と数えるのは誤り**
 * (2026-08、雛形が未検証と出ていた)。`validate<名前>(` / `<名前>Schema.parse` を
 * 通していれば検証済みとみなす。
 *
 * **変数名を `body` に限定しない。** `vitals/route.ts` は `payload` という
 * 変数名で `typeof value !== "number"` のように分割代入後の変数を検査して
 * おり、`body.` を前提にした正規表現では拾えなかった
 * (2026-08、雛形と同じ「検査側の見落とし」で発見)。
 */
const HAND_CHECKED = /typeof\s+(body|payload)\.|typeof\s+\w+\s*!==\s*"(string|number|boolean)"|!body\.|Number\.isSafeInteger|Number\.isInteger|Array\.isArray\s*\(\s*(body|payload)\.|\bvalidate[A-Z]\w*\s*\(|\.test\(\s*(body|payload)\./;

/** 理由つきの免除。 */
const EXEMPT = /\/\/\s*no-body-validation:\s*\S+/;

/** `apps/` 配下の route.ts を集める。 */
function collectRoutes() {
  const appsDir = path.join(ROOT, "apps");
  if (!existsSync(appsDir)) return [];
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (e.name === "route.ts") out.push(p);
    }
  };
  walk(appsDir);
  return out;
}

/** 分類する。 */
function classify() {
  const rows = { schema: [], hand: [], none: [], exempt: [] };
  for (const file of collectRoutes()) {
    const text = readFileSync(file, "utf8");
    if (!READS_BODY.test(text)) continue;
    const rel = path.relative(ROOT, file);
    if (EXEMPT.test(text)) { rows.exempt.push(rel); continue; }
    if (USES_SCHEMA.test(text)) { rows.schema.push(rel); continue; }
    if (HAND_CHECKED.test(text)) { rows.hand.push(rel); continue; }
    rows.none.push(rel);
  }
  return rows;
}

export function check({ list = false, setFloor = false } = {}) {
  const rows = classify();
  const total = rows.schema.length + rows.hand.length + rows.none.length;
  if (total === 0) {
    console.log("⏭  check-input-validation は skip しました(0 件を検査 / 本文を読むルートがありません)");
    return { ok: true, skipped: true };
  }
  // **未検証の「件数」を見る。** 率にすると、ルートが増えただけで良く見える。
  const current = { unvalidated: rows.none.length, schemaBased: rows.schema.length };

  if (list) {
    console.log(`\n【入力を検証していない】${rows.none.length} 件`);
    for (const f of rows.none.slice(0, 60)) console.log(`  ${f}`);
    if (rows.none.length > 60) console.log(`  ほか ${rows.none.length - 60} 件`);
    console.log(`\n【手書きで検証】${rows.hand.length} 件（可。いずれ validate() へ）`);
    console.log(`【スキーマで検証】${rows.schema.length} 件（推奨）`);
    console.log(`【免除】${rows.exempt.length} 件`);
    console.log(`\n(本文を読むルート ${total} 本を検査)`);
    return { ok: true };
  }

  if (setFloor) {
    writeFileSync(
      FLOOR_FILE,
      JSON.stringify(
        {
          _comment:
            "API の入力検証の状態。unvalidated は上限（増やさない）、schemaBased は下限（減らさない）。直したら --set-floor で刻み直す。",
          updatedAt: new Date().toISOString().slice(0, 10),
          limits: current,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`✅ 記録しました(未検証 ${current.unvalidated} 件 / スキーマ検証 ${current.schemaBased} 件)`);
    return { ok: true };
  }

  const floor = existsSync(FLOOR_FILE) ? JSON.parse(readFileSync(FLOOR_FILE, "utf8")).limits ?? {} : {};
  const problems = [];
  if (floor.unvalidated !== undefined && current.unvalidated > floor.unvalidated) {
    problems.push(
      `入力を検証しないルートが ${current.unvalidated} 件に増えました(上限 ${floor.unvalidated})\n` +
        `     → \`validate(schema, body)\`(@platform/validation)を通してください\n` +
        `     → 本文を使わないなら \`// no-body-validation: <理由>\` をその場に書いてください`,
    );
  }
  if (floor.schemaBased !== undefined && current.schemaBased < floor.schemaBased) {
    problems.push(
      `スキーマで検証するルートが ${current.schemaBased} 件に減りました(下限 ${floor.schemaBased})\n` +
        `     → 手書きへ戻すと、抜けても気づけなくなります`,
    );
  }

  if (problems.length > 0) {
    console.error(`❌ 入力検証が悪化しました(${problems.length} 件):`);
    for (const p of problems) console.error(`   ${p}`);
    console.error("");
    console.error("   **`as Record<string, string>` は型の嘘です。** 実行時には何でも入ります。");
    console.error("   一覧: node tools/check-input-validation.mjs --list");
    return { ok: false };
  }

  console.log(
    `✅ 入力検証は基準内(本文を読む ${total} 本 / スキーマ ${rows.schema.length}・手書き ${rows.hand.length}・未検証 ${rows.none.length}・免除 ${rows.exempt.length})`,
  );
  return { ok: true };
}

// **`file://${process.argv[1]}` で比べない。** Windows では
// `import.meta.url` が `file:///C:/…`、`process.argv[1]` が `C:\…` になり、
// **一致しないので本体が動かない**(何も出力せず終わる。エラーも出ないので気づけない)。
// 2026-08、`node tools/check-coverage.mjs --set-floor` が Windows で無反応だった。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = check({
    list: process.argv.includes("--list"),
    setFloor: process.argv.includes("--set-floor"),
  });
  process.exit(r.ok ? 0 : 1);
}
