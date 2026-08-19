/**
 * リポジトリの構成ツリーを組み立てる。
 *
 * **目的は「どこを触ればいいか」を迷わせないこと。** 単なるファイル一覧なら
 * エディタで見れば済む。ここが返すのは、**各フォルダが何を置く場所か**と、
 * **触ってよいかどうか**の注釈が付いたツリー。
 *
 * 注釈の元は CLAUDE.md の作法。資料を読まないと分からない決まりを、
 * 構成を眺めるだけで気づける場所に置き直している。
 *
 * fs アクセスはサーバ側(Route Handler)からのみ。
 * @packageDocumentation
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** リポジトリルート(apps/platform-portal から 2 つ上)。 */
// 生成時に使う(実行時にファイルを読まない)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * 展開しても意味が無い/重いフォルダ。
 *
 * `node_modules` を含めると数万件になり、画面が固まる。生成物(.next 等)は
 * 触る対象ではないので出さない。
 */
const SKIP = new Set([
  "node_modules", ".next", ".turbo", "dist", ".git", "coverage",
  "test-results", "playwright-report", ".vercel", ".pnpm-store",
]);

/**
 * 既定の深さ。
 *
 * `packages/<名前>/src/<ファイル>` がちょうど 4 段目。**触る単位まで見えて、
 * かつ一覧として読める**のがこの深さだった(5 段にすると 2,491 件で探しにくくなる)。
 */
const DEFAULT_MAX_DEPTH = 4;

/** ツリーの 1 ノード。`@platform/ui` の `TreeNode` に合わせて詰め替えられる形にしてある。 */
export interface RepoNode {
  /** ルートからの相対パス(そのまま ID に使う)。 */
  id: string;
  /** 表示名(フォルダ名 / ファイル名)。 */
  name: string;
  /** フォルダか、ファイルか。 */
  kind: "dir" | "file";
  /** ここが何を置く場所かの説明。無い場合もある。 */
  note?: string;
  /** **触ってよいか**。`caution` は「別 PR にする」等の注意付き。 */
  edit?: "app" | "caution" | "generated";
  /** 子(ファイルには無い)。 */
  children?: RepoNode[];
  /** 深さ上限で打ち切った場合の、この下にある件数。 */
  truncated?: number;
}

/**
 * フォルダの役割。**ここが本体**で、ツリーはこれを配るための器。
 *
 * キーはルートからの相対パス。`*` は 1 段ぶんの任意の名前
 * (`packages/*` なら「packages の直下すべて」)。
 */
const NOTES: Record<string, { note: string; edit?: RepoNode["edit"] }> = {
  "packages": {
    note: "基盤。共通機能の唯一の実装元。アプリ作業中は触らず、別タスク・別 PR にする(CLAUDE.md 大原則 1)",
    edit: "caution",
  },
  "packages/*": { note: "1 パッケージ = 1 機能。公開 API は src/index.ts の export だけ", edit: "caution" },
  "packages/*/src": { note: "実装。内部ファイルへアプリから import してはいけない(ESLint boundaries が禁止)", edit: "caution" },
  "apps": { note: "業務アプリ。業務ロジックと画面はここに書く", edit: "app" },
  "apps/*": { note: "1 アプリ。汎用処理を書かないこと(基盤にあるものを使う)", edit: "app" },
  "apps/*/src": { note: "アプリの中身", edit: "app" },
  "apps/*/src/app": { note: "画面と API(Next.js App Router)。api/**/route.ts は認可を通すか、理由を宣言する", edit: "app" },
  "apps/*/src/server": { note: "サーバ側の処理(DB・認可・計装)。ブラウザには出ない", edit: "app" },
  "apps/*/src/components": { note: "このアプリ専用の画面部品。他でも使うなら @platform/ui へ移す", edit: "app" },
  "apps/*/src/lib": { note: "このアプリ専用の補助。汎用なら基盤へ", edit: "app" },
  "apps/*/prisma": { note: "DB スキーマ。反映は db push(履歴は持たない。ADR-0013)", edit: "app" },
  "demos": { note: "基盤の使い方を示す実例集。新機能の書き方はここを見るのが早い", edit: "app" },
  "apps/showcase": { note: "統合デモ(:3001)。デモを足すときは docs/ops/ADD_DEMO.md の 5 か所を更新", edit: "app" },
  "tools": { note: "検査・生成スクリプト。preflight がここを順に呼ぶ", edit: "caution" },
  "docs": { note: "資料。索引は docs/README.md" },
  "docs/adr": { note: "設計判断の記録。方針を変えるときは新しい 1 枚を足す" },
  "docs/ai": { note: "AI・新規参加者向け。module-list.md で既存部品を探す" },
  "docs/ops": { note: "運用手順。引き継ぎは HANDOVER.md から" },
  "docs/platform": { note: "基盤ドキュメント(一部は自動生成)", edit: "generated" },
  "docs/apps": { note: "アプリドキュメント" },
  "e2e": { note: "ブラウザで実操作するテスト(Playwright。DB が要る)", edit: "app" },
  "ops": { note: "運用の記録(復元訓練の結果など)" },
  "scripts": { note: "セットアップ(setup.sh / setup.ps1)" },
  ".github": { note: "CI/CD。ワークフローの定義" },
};

/** ファイル単位の説明。名前が一致したものに付ける。 */
const FILE_NOTES: Record<string, string> = {
  "CLAUDE.md": "作法。人にも AI にも同じく適用される。作業前に読む",
  "README.md": "そのフォルダの用途と使い方",
  "package.json": "依存とスクリプト。足したら pnpm install して lockfile も一緒にコミット",
  "index.ts": "公開 API。ここから export したものだけが外から使える",
  ".env.example": "環境変数の見本。増やしたら必ず追記(CI が検査する)",
  "pnpm-lock.yaml": "依存の固定。手で編集しない",
  "schema.prisma": "DB スキーマ",
};

/** パターン(`*` を含むキー)に相対パスが一致するか。 */
function matchPattern(pattern: string, rel: string): boolean {
  const pat = pattern.split("/");
  const seg = rel.split("/");
  if (pat.length !== seg.length) return false;
  return pat.every((p, i) => p === "*" || p === seg[i]);
}

/** 相対パスに対応する説明を引く(完全一致 → パターンの順)。 */
function lookupNote(rel: string): { note: string; edit?: RepoNode["edit"] } | undefined {
  const exact = NOTES[rel];
  if (exact !== undefined) return exact;
  for (const [pattern, value] of Object.entries(NOTES)) {
    if (pattern.includes("*") && matchPattern(pattern, rel)) return value;
  }
  return undefined;
}

/**
 * パッケージ README の 1 行目の説明を取り出す。
 *
 * 見出し(`# @platform/x`)の次にある最初の本文を使う。**113 個の README を
 * 書いてあるのに一覧から見えない**のはもったいないので、ツリーに出す。
 */
function packageSummary(pkgDir: string): string | undefined {
  const file = path.join(ROOT, pkgDir, "README.md");
  if (!existsSync(file)) return undefined;
  const lines = readFileSync(file, "utf8").split("\n");
  for (const line of lines) {
    const text = line.trim();
    if (text === "" || text.startsWith("#") || text.startsWith(">")) continue;
    return text.replace(/[`*]/g, "").slice(0, 120);
  }
  return undefined;
}

/** そのフォルダ以下にある項目数(打ち切り表示用)。 */
function countBelow(dir: string): number {
  let n = 0;
  const walk = (d: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return; // 読めないものは数えない(権限・壊れたリンク)
    }
    for (const name of entries) {
      if (SKIP.has(name)) continue;
      n += 1;
      const full = path.join(d, name);
      try {
        if (statSync(full).isDirectory()) walk(full);
      } catch {
        // 消えた/辿れないものは無視する
      }
    }
  };
  walk(dir);
  return n;
}

function buildNode(abs: string, rel: string, depth: number, maxDepth: number): RepoNode {
  const name = path.basename(abs);
  const isDir = statSync(abs).isDirectory();
  const meta = lookupNote(rel);

  const node: RepoNode = {
    id: rel,
    name,
    kind: isDir ? "dir" : "file",
    ...(meta?.note !== undefined && { note: meta.note }),
    ...(meta?.edit !== undefined && { edit: meta.edit }),
  };

  if (!isDir) {
    const fileNote = FILE_NOTES[name];
    if (node.note === undefined && fileNote !== undefined) node.note = fileNote;
    if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) node.note ??= "テスト";
    if (name.includes(".generated.")) {
      node.note ??= "自動生成。手で編集しない";
      node.edit = "generated";
    }
    return node;
  }

  // パッケージ直下は README の説明で上書きする(汎用の注釈より具体的で役に立つ)
  if (matchPattern("packages/*", rel)) {
    const summary = packageSummary(rel);
    if (summary !== undefined) node.note = summary;
  }

  if (depth >= maxDepth) {
    const below = countBelow(abs);
    if (below > 0) node.truncated = below;
    return node;
  }

  const children = readdirSync(abs)
    .filter((child) => !SKIP.has(child))
    .map((child) => buildNode(path.join(abs, child), `${rel}/${child}`, depth + 1, maxDepth))
    // フォルダを先、その中で名前順。探すときに目が滑らない
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "dir" ? -1 : 1));

  if (children.length > 0) node.children = children;
  return node;
}

/**
 * リポジトリ構成のツリーを組み立てる。
 *
 * @param maxDepth 何段目まで展開するか(既定 {@link DEFAULT_MAX_DEPTH})。
 *                 深くすると件数が増えて探しにくくなる
 * @returns ルート直下のノード。**隠しファイルと生成物は含まない**
 */
export function buildRepoTree(maxDepth: number = DEFAULT_MAX_DEPTH): RepoNode[] {
  return readdirSync(ROOT)
    .filter((name) => {
      if (SKIP.has(name)) return false;
      // 隠しフォルダは基本的に出さないが、.github は CI の定義があり
      // 「どこを直せば CI が変わるか」を知りたい対象なので例外にする
      if (name === ".github") return true;
      return !name.startsWith(".");
    })
    .map((name) => buildNode(path.join(ROOT, name), name, 1, maxDepth))
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "dir" ? -1 : 1));
}
