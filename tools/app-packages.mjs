/**
 * **`FEATURES` に載っていないパッケージも選べるようにする。**
 *
 * 【なぜ要るか】
 * `FEATURES` は **26 の「機能」**です——ログイン、メール送信、承認フローのように、
 * **繋ぎ方まで含めた見本**を持っています（ファイル・環境変数・README も足す）。
 *
 * ですが基盤には **120 のパッケージ**があり、
 * **残り 61 は選択肢に出ていません**でした。
 *
 * > 「郵便番号から住所を引きたい」→ `@platform/address` がある。
 * > **でも `pnpm new-app` の選択肢に出てこない。**
 *
 * 使う人は**あることを知らないまま自作します**。これがこのリポジトリで
 * 繰り返し起きている失敗（`check-reimplementation` の存在理由）です。
 *
 * 【機能と「部品」の違い】
 *
 * | | `FEATURES`（機能） | ここ（部品） |
 * |---|---|---|
 * | 足すもの | 依存 + **ファイル + 環境変数 + README** | **依存だけ** |
 * | 見本 | **繋ぎ方まで入る** | 入らない（README を読んで自分で繋ぐ） |
 * | 例 | 「ログイン」「承認フロー」 | 「住所」「バーコード」「単位換算」 |
 *
 * **部品は依存を足すだけ**です。それでも意味があります——
 * **`package.json` に入っていれば、補完に出てきます**。
 * 「あることを知らない」状態を抜けられます。
 *
 * 【説明はどこから来るか】
 * **各パッケージの README の 3 行目**（`# @platform/x` の次の空行の後）です。
 * ここに 1 行の要約を書く決まりになっており、`check-package-shape` が
 * **README の存在を強制**しています。**説明を二重に持たない**ため、
 * ここでは書き写さず読み取ります。
 *
 * @packageDocumentation
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CATEGORIES } from "./package-categories.mjs";
import { FEATURES } from "./app-features.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * **雛形に最初から入っているもの。**
 *
 * 選択肢に出しても意味がない（既に入っている）ので除きます。
 */
function templateDeps() {
  const p = path.join(ROOT, "apps/crud-template/package.json");
  if (!existsSync(p)) return new Set();
  const json = JSON.parse(readFileSync(p, "utf8"));
  return new Set(Object.keys(json.dependencies ?? {}).filter((d) => d.startsWith("@platform/")));
}

/**
 * README の 1 行要約を読む。
 *
 * **Markdown の記号は落とす。** `**重なりを防ぎます**` のままだと、
 * ターミナルに `**` がそのまま出て読みにくい。
 *
 * @param dir パッケージのディレクトリ名
 * @returns 1 行の説明（読めなければ空文字）
 */
function summaryOf(dir) {
  const p = path.join(ROOT, "packages", dir, "README.md");
  if (!existsSync(p)) return "";
  const lines = readFileSync(p, "utf8").split("\n");
  for (const line of lines.slice(1, 12)) {
    const text = line.trim();
    // 見出し・引用（注意書き）・空行は飛ばす
    if (text === "" || text.startsWith("#") || text.startsWith(">")) continue;
    return text.replace(/\*\*/g, "").replace(/`/g, "").slice(0, 90);
  }
  return "";
}

/** パッケージ名 → カテゴリ。 */
function categoryOf() {
  const map = new Map();
  for (const [category, names] of Object.entries(CATEGORIES)) {
    for (const n of names) map.set(n.startsWith("@platform/") ? n : `@platform/${n}`, category);
  }
  return map;
}

/**
 * **`FEATURES` に無いパッケージ**を、選択肢の形で返す。
 *
 * `FEATURES` と同じ形（`id` / `category` / `label` / `hint` / `deps`）なので、
 * **`new-app` 側は区別せずに扱えます**。
 *
 * @returns 選択肢の配列（カテゴリ順 → 名前順）
 *
 * @example
 * ```js
 * import { FEATURES } from "./app-features.mjs";
 * import { extraPackageChoices } from "./app-packages.mjs";
 * const all = [...FEATURES, ...extraPackageChoices()];
 * ```
 */
export function extraPackageChoices() {
  const inTemplate = templateDeps();
  const inFeatures = new Set(FEATURES.flatMap((f) => f.deps ?? []));
  const cats = categoryOf();

  const dirs = readdirSync(path.join(ROOT, "packages"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const out = [];
  for (const dir of dirs) {
    const pkgPath = path.join(ROOT, "packages", dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    const json = JSON.parse(readFileSync(pkgPath, "utf8"));
    const name = json.name;
    // 既に入っている・機能として選べるものは出さない
    if (inTemplate.has(name) || inFeatures.has(name)) continue;
    // **`config` は開発用の設定集。** アプリの依存にするものではない
    if (name === "@platform/config") continue;

    const tier = json.platform?.tier ?? "stable";
    const summary = summaryOf(dir);
    out.push({
      id: `pkg:${dir}`,
      category: cats.get(name) ?? "その他",
      label: name.replace("@platform/", ""),
      // **成熟度を添える。** `incubating` は形が変わりうるので、
      // 選ぶ人が知っておくべき情報(ADR 0023)
      hint: tier === "incubating" ? `${summary}（形が変わることがあります）` : summary,
      deps: [name],
      // **`FEATURES` と同じ形にそろえる。** 空でも必ず持たせる——
      // 呼び出し側で `f.env?.length` のように書き分けると、
      // **足すたびに分岐が増え、そのうち書き忘れる**
      // (2026-08、`f.env.length` で落ちた)
      env: [],
      envSchema: [],
      files: {},
      readme: `- \`${name}\` … ${summary}`,
      // **部品は依存だけ。** 繋ぎ方の見本は持たない
      packageOnly: true,
    });
  }

  out.sort((a, b) => (a.category === b.category
    ? a.label.localeCompare(b.label)
    : a.category.localeCompare(b.category)));
  return out;
}

/**
 * **機能と部品を合わせた全選択肢。**
 *
 * **機能を先に置く。** 繋ぎ方の見本が入る方が価値が高いので、
 * 同じことができるなら**機能の方を選んでほしい**——
 * 「メール送信」を選べば送信の見本が入りますが、
 * `@platform/mail` を選んでも依存が足りるだけです。
 *
 * @returns すべての選択肢
 */
export function allChoices() {
  return [...FEATURES, ...extraPackageChoices()];
}
