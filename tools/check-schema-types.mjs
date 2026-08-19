/**
 * **Prisma schema の型の落とし穴**を検査する(下限ラチェット方式)。
 *   node tools/check-schema-types.mjs
 *   node tools/check-schema-types.mjs --list      … 該当箇所を一覧
 *   node tools/check-schema-types.mjs --set-limit … 直したら上限を下げる
 *
 * 【なぜ必要か】
 *
 * `check-schema.mjs` が見ているのは **model 名の重複・`@id` の有無・括弧の対応**だけで、
 * **カラムの型は誰も見ていなかった**。2026-08 の点検で次が見つかった:
 *
 * | 問題 | 件数 | 何が起きるか |
 * |---|---|---|
 * | **金額が `Float`** | 21 | 二進小数では 0.1 を正確に表せず、**足すたびに誤差が積もる** |
 * | **日時が `String`** | 36 | 比較・範囲検索が文字列順になり、索引も効きにくい |
 *
 * ### 金額に `Float` を使ってはいけない理由
 *
 * `Float` は IEEE 754 の二進小数で、**10 進の小数を正確に表せない**。
 * `0.1 + 0.2 !== 0.3` はここから来る。1 件では見えないが、
 * **明細を合計し、税を掛け、月次で足し込む**と誤差が積もり、
 * **請求書の合計が 1 円合わない**という形で表に出る。
 *
 * 会計では「合わない」こと自体が問題になる——原因の特定に何時間もかかり、
 * **監査でも説明できない**。
 *
 * **円なら `Int`(最小単位で持つ)** が最も安全。小数が要る通貨や単価は
 * `Decimal @db.Decimal(p, s)` を使う(PostgreSQL の `numeric` は 10 進で正確)。
 *
 * ### 日時に `String` を使う問題
 *
 * `"2026-8-1"` と `"2026-08-01"` が別物になり、**並べ替えが壊れる**。
 * タイムゾーンも表現できないので、`@platform/datetime` が吸収している
 * JST の扱いを DB 側で再現できない。範囲検索(`WHERE date BETWEEN ...`)も
 * 文字列比較になり、**索引が効いても意図した結果にならない**ことがある。
 *
 * `DateTime`(PostgreSQL の `timestamptz`)を使うこと。
 *
 * 【なぜ上限方式か】
 *
 * **型の変更はデータ移行を伴う**。`Float` → `Int` は単位が変わり
 * (円 → 円のままでも小数を落とす判断が要る)、既存データの読み替えが必要になる。
 * 一度に直せないので、**今より悪くしないことだけを守る**
 * (`check-maintainability` と同じ考え方)。
 *
 * **直すときは 1 モデルずつ**、`--set-limit` で上限を下げながら進める。
 */
import { readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = path.join(ROOT, "tools", "schema-types-limit.json");

/**
 * 金額を表すカラム名。**ここに載る名前で `Float` なら指摘する。**
 *
 * 名前で判断するのは乱暴だが、Prisma schema には単位も意味も書けない。
 * **取りこぼすより、名前で拾って個別に許す方が安全**である。
 *
 * **取りこぼしは実際に起きた。** 2026-08 の初回計測は `base` を含んでおらず、
 * `FeePaymentRow.base`(手数料の基準額)を見逃していた。
 * **金額を表す語は業務ごとに違う**ので、見つけたらここへ足すこと。
 */
const MONEY_WORDS = /(amount|price|total|subtotal|tax|cost|fee|wage|salary|proceeds|balance|paid|revenue|budget|base)/i;

/** 日時を表すカラム名。 */
const DATE_WORDS = /(date|At|time)$/;

/**
 * **`Int` の金額を受け取る API が、整数で検証しているか**も見る。
 *
 * 型を `Int` に変えても、**入口が小数を通せば書き込みで落ちる**。
 * 2026-08 の移行前、入金 API は `typeof body.amount !== "number"` しか見ておらず、
 * **`1000.5` がそのまま DB に入っていた**。
 *
 * ここで見るのは「金額らしき body を受けるルートが `Number.isSafeInteger` を
 * 通しているか」。**名前で拾うので取りこぼしはある**が、
 * 「整数で受ける」という作法をコードに残す効果の方が大きい。
 */
const MONEY_BODY = /body\.(amount|cost|total|subtotal|price|budget)\b/;

/** 例外(理由を必ず書く)。`<model>.<field>` で指定する。 */
const ALLOW = {
  // 数量は小数がありうる(0.5 個の発注、1.5 時間)。金額ではない
  "InventoryItem.dailyDemand": "需要予測。金額ではなく、小数に意味がある",
  "StockMove.quantity": "数量。0.5 個のような入出庫がありうる",
};

/** schema.prisma を集める(アプリごとに分かれている)。 */
function collectSchemas() {
  const appsDir = path.join(ROOT, "apps");
  if (!existsSync(appsDir)) return [];
  const out = [];
  for (const name of readdirSync(appsDir)) {
    const p = path.join(appsDir, name, "prisma", "schema.prisma");
    if (existsSync(p)) out.push({ app: name, file: p });
  }
  return out;
}

/**
 * 1 つの schema を走査して、該当するフィールドを返す。
 *
 * @param file schema.prisma のパス
 * @returns `{ kind, model, field, type, line }` の配列
 */
function scan(file) {
  const lines = readFileSync(file, "utf8").split("\n");
  const found = [];
  let model = "";
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const mm = line.match(/^model\s+([A-Za-z0-9_]+)\s*\{/);
    if (mm) {
      model = mm[1];
      continue;
    }
    if (/^\}/.test(line)) {
      model = "";
      continue;
    }
    if (model === "") continue;
    // `  fieldName  Type ...`
    const fm = line.match(/^\s{2,}([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)(\?|\[\])?\s*(.*)$/);
    if (!fm) continue;
    const [, field, type] = fm;
    const key = `${model}.${field}`;
    if (key in ALLOW) continue;
    if (type === "Float" && MONEY_WORDS.test(field)) {
      found.push({ kind: "money-float", model, field, type, line: i + 1 });
    }
    if (type === "String" && DATE_WORDS.test(field)) {
      found.push({ kind: "date-string", model, field, type, line: i + 1 });
    }
  }
  return found;
}

/**
 * 金額を受ける API のうち、整数検証を通していないものを返す。
 *
 * @returns `apps/.../route.ts` の相対パス配列
 */
function scanMoneyInputs() {
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
      if (e.name !== "route.ts") continue;
      const text = readFileSync(p, "utf8");
      if (!MONEY_BODY.test(text)) continue;
      if (/Number\.isSafeInteger|Number\.isInteger/.test(text)) continue;
      // 小数を許す宣言(理由つき)があれば対象外
      if (/\/\/\s*money-decimal:\s*\S+/.test(text)) continue;
      out.push(path.relative(ROOT, p));
    }
  };
  walk(appsDir);
  return out;
}

export function check({ list = false, setLimit = false } = {}) {
  const schemas = collectSchemas();
  if (schemas.length === 0) {
    console.log("⏭  check-schema-types は skip しました(0 件を検査 / schema.prisma がありません)");
    return { ok: true, skipped: true };
  }

  const all = [];
  for (const { app, file } of schemas) {
    for (const f of scan(file)) all.push({ ...f, app, file: path.relative(ROOT, file) });
  }
  const looseInputs = scanMoneyInputs();
  const counts = {
    "money-float": all.filter((f) => f.kind === "money-float").length,
    "date-string": all.filter((f) => f.kind === "date-string").length,
    "loose-money-input": looseInputs.length,
  };

  if (list) {
    for (const kind of ["money-float", "date-string"]) {
      const rows = all.filter((f) => f.kind === kind);
      const label = kind === "money-float" ? "金額が Float" : "日時が String";
      console.log(`\n【${label}】${rows.length} 件`);
      for (const r of rows.slice(0, 40)) {
        console.log(`  ${r.file}:${r.line}  ${r.model}.${r.field}: ${r.type}`);
      }
      if (rows.length > 40) console.log(`  ほか ${rows.length - 40} 件`);
    }
    console.log(`\n【金額を整数で検証していない API】${looseInputs.length} 件`);
    for (const f of looseInputs.slice(0, 20)) console.log(`  ${f}`);
    if (looseInputs.length > 20) console.log(`  ほか ${looseInputs.length - 20} 件`);
    console.log(`\n(${schemas.length} 個の schema.prisma を検査)`);
    return { ok: true };
  }

  if (setLimit) {
    writeFileSync(
      LIMIT_FILE,
      JSON.stringify(
        {
          _comment:
            "schema の型の落とし穴の上限。増やさないための歯止め。直したら --set-limit で下げる。金額は Int か Decimal、日時は DateTime にする。",
          updatedAt: new Date().toISOString().slice(0, 10),
          limits: counts,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`✅ 上限を更新しました(金額 Float ${counts["money-float"]} / 日時 String ${counts["date-string"]})`);
    return { ok: true };
  }

  const limits = existsSync(LIMIT_FILE) ? JSON.parse(readFileSync(LIMIT_FILE, "utf8")).limits ?? {} : {};
  const over = [];
  for (const kind of ["money-float", "date-string", "loose-money-input"]) {
    const limit = limits[kind];
    if (limit !== undefined && counts[kind] > limit) {
      over.push(
        kind === "money-float"
          ? `金額が Float のカラムが ${counts[kind]} 件に増えました(上限 ${limit})\n     → 円なら Int、小数が要るなら Decimal @db.Decimal を使ってください`
          : kind === "date-string"
            ? `日時が String のカラムが ${counts[kind]} 件に増えました(上限 ${limit})\n     → DateTime(timestamptz)を使ってください`
            : `金額を整数で検証していない API が ${counts[kind]} 件に増えました(上限 ${limit})\n     → \`Number.isSafeInteger\` で弾いてください(小数が要るなら \`// money-decimal: <理由>\`)`,
      );
    }
  }

  if (over.length > 0) {
    console.error(`❌ schema の型が悪化しました(${over.length} 件):`);
    for (const o of over) console.error(`   ${o}`);
    console.error("");
    console.error("   **金額の Float は、足すたびに誤差が積もり、請求書の合計が合わなくなります。**");
    console.error("   一覧: node tools/check-schema-types.mjs --list");
    return { ok: false };
  }

  console.log(
    `✅ schema の型は上限内(${schemas.length} 個の schema / 金額 Float ${counts["money-float"]} 件・日時 String ${counts["date-string"]} 件・整数検証なしの API ${counts["loose-money-input"]} 件)`,
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
    setLimit: process.argv.includes("--set-limit"),
  });
  process.exit(r.ok ? 0 : 1);
}
