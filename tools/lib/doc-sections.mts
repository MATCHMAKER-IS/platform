/**
 * 社内資料(docs/ + CLAUDE.md 等)を**見出し単位**で索引し、検索できるようにする。
 *
 * なぜ見出し単位か:
 *   ファイル全体を 1 件として返すと、73 件の資料では「どの資料か」しか分からない。
 *   知りたいのは「どこに書いてあるか」なので、`##` で切って節ごとに引く。
 *
 * このファイルは**外部依存を持たない**(索引作成は doc-search.mts が担当)。
 * 生成ツールから依存なしで呼べるようにするため、分割している。
 *
 * 検索は @platform/search の BM25。埋め込み(ベクトル検索)を使わない理由:
 *   - 外部 API と鍵が要る。オフラインの CI や、鍵を持たない開発者の手元で動かなくなる
 *   - 資料は語彙が限られており、キーワード検索でも十分な精度が出る
 *   将来ベクトル検索へ移す場合は @platform/rag の VectorIndex に差し替える
 *   (RagStore は同じ「chunk → 検索」の形なので、この層の入れ替えで済む)。
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

/** 索引に入れる 1 節。 */
export interface DocSection {
  /** `docs/ops/CHECKS.md#検査の一覧` の形 */
  id: string;
  /** リポジトリからの相対パス */
  file: string;
  /** 見出し(無い場合はファイル名) */
  heading: string;
  /** 親の見出し(階層を辿れるようにする) */
  breadcrumb: string;
  /** 本文(コードブロックを含む) */
  body: string;
  /** パッケージ README なら、その名前(例 "csv")。検索で強く効かせる */
  pkg?: string;
}

/** 索引対象。自動生成物は「読ませる価値はあるが、直す先ではない」ため印を付ける。 */
const GENERATED = [/^docs\/platform\//, /^docs\/ai\/(module-list|advisor-report|platform-report)\.md$/, /^docs\/site\//];

export function isGenerated(rel: string): boolean {
  return GENERATED.some((re) => re.test(rel));
}

/** docs 配下と、ルートの主要な資料を集める。 */
function collectFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules") continue;
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) walk(fp);
      else if (e.name.endsWith(".md")) out.push(fp);
    }
  };
  walk(path.join(root, "docs"));
  for (const f of ["CLAUDE.md", "README.md", "CONTRIBUTING.md"]) {
    const p = path.join(root, f);
    if (existsSync(p)) out.push(p);
  }
  // パッケージの README も入れる。
  // 「どうやって〜するか」(手順書)と同じくらい、「どの部品を使うか」(README)を
  // 探したい場面が多いため。両方が同じ検索で引ける状態にする。
  const pkgDir = path.join(root, "packages");
  if (existsSync(pkgDir)) {
    for (const d of readdirSync(pkgDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const readme = path.join(pkgDir, d.name, "README.md");
      if (existsSync(readme)) out.push(readme);
    }
  }
  return out;
}

/**
 * 資料を見出し単位の節に分ける。
 *
 * @param root リポジトリのルート
 * @returns 節の配列(本文が空のものは除く)
 */
export function loadDocSections(root: string): DocSection[] {
  const sections: DocSection[] = [];

  for (const file of collectFiles(root)) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const lines = readFileSync(file, "utf8").split("\n");

    let heading = path.basename(rel);
    let level = 0;
    const stack: string[] = [];
    let buf: string[] = [];

    const flush = () => {
      const body = buf.join("\n").trim();
      if (body === "") return;
      const pkg = /^packages\/([a-z0-9-]+)\/README\.md$/.exec(rel)?.[1];
      sections.push({
        id: `${rel}#${heading}`,
        file: rel,
        heading,
        breadcrumb: stack.join(" > "),
        body,
        ...(pkg ? { pkg } : {}),
      });
    };

    for (const line of lines) {
      const m = /^(#{1,4})\s+(.+)$/.exec(line);
      if (m) {
        flush();
        buf = [];
        level = m[1]!.length;
        heading = m[2]!.trim();
        stack.length = Math.max(0, level - 1);
        stack[level - 1] = heading;
      } else {
        buf.push(line);
      }
    }
    flush();
  }

  return sections;
}

/** 本文から、問い合わせ語の周辺を抜き出す(長い節をそのまま返さないため)。 */
export function excerpt(body: string, query: string, max = 240): string {
  const flat = body.replace(/\s+/g, " ").trim();
  const terms = query.split(/\s+/).filter((t) => t.length >= 2);
  let at = -1;
  for (const t of terms) {
    const i = flat.toLowerCase().indexOf(t.toLowerCase());
    if (i >= 0) { at = i; break; }
  }
  if (at < 0) return flat.slice(0, max) + (flat.length > max ? "…" : "");
  const start = Math.max(0, at - 60);
  return (start > 0 ? "…" : "") + flat.slice(start, start + max) + (start + max < flat.length ? "…" : "");
}
