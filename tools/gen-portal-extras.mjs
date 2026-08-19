#!/usr/bin/env node
/**
 * 基盤ポータルの付加情報(構成・ヘルス・ADR・Advisor・設計)を固める(自動生成)。
 *   node tools/gen-portal-extras.mjs
 *
 * 入力: docs/ai/module-list.md / docs/adr/ / docs/platform/ ほか
 * 出力: apps/showcase/src/lib/portal-extras.generated.ts
 *
 * 【なぜ生成物にするか】
 * これは `apps/platform-portal` にあった機能を apps/showcase へ移したもの。
 * 元は**実行時にファイルを読んでいた**が、デモは静的配信なのでそれができない。
 * `process.cwd()` は配置によって想定と違う場所を指すため、
 * ファイル I/O に頼ると画面が壊れる(gen-portal-reference.mjs と同じ理由)。
 *
 * 【なぜアプリを消してデモに寄せたか】
 * `platform-portal` は開発者向けの 1 画面アプリで、デプロイ単位・担当者・利用者の
 * どれも showcase と同じだった。**同じものを 2 か所で保守しない**(ADR-0015)。
 *
 * 生成物は **Server Component から import する**こと(クライアントへ送らない)。
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalog } from "./lib/portal-catalog.mts";
import { buildRepoTree } from "./lib/portal-tree.mts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "apps/showcase/src/lib/portal-extras.generated.ts");

const catalog = buildCatalog();
// **構成ツリーは深さを絞る。** 全部入れると生成物が数 MB になり、
// 画面の読み込みが目に見えて遅くなる(見たいのは全体の形であって全ファイルではない)
const tree = buildRepoTree(3);

const body = `// このファイルは自動生成です。編集しないでください。
// 生成: node tools/gen-portal-extras.mjs
/**
 * 基盤ポータルの付加情報(構成・ヘルス・ADR・Advisor・設計)。
 *
 * **実行時にファイルを読まないために固めてある。**
 * 元は apps/platform-portal が \`process.cwd()\` 起点で読んでいたが、
 * 配置によって壊れるため生成物へ移した。
 * @packageDocumentation
 */

/** リポジトリの構成(ディレクトリツリー)。 */
export interface RepoNode {
  /** ルートからの相対パス(そのまま ID に使う)。 */
  id: string;
  name: string;
  kind: "dir" | "file";
  /** ここが何を置く場所かの説明。無い場合もある。 */
  note?: string;
  /** **触ってよいか**。\`caution\` は「別 PR にする」等の注意付き。 */
  edit?: "app" | "caution" | "generated";
  children?: RepoNode[];
  /** 深さ上限で打ち切った場合の、この下にある件数。 */
  truncated?: number;
}

/** ADR 1 件。 */
export interface AdrInfo {
  id: string;
  title: string;
  status: string;
  /** ADR ファイル名(リンク生成用)。 */
  file: string;
}

/** ポータルの付加情報。 */
export interface PortalExtras {
  /** 生成した時刻(古さを画面に出すため)。 */
  generatedAt: string;
  /** 主要な数値(パッケージ数・テスト数など)。 */
  health: { label: string; value: string }[];
  /** 設計判断の記録。 */
  adrs: AdrInfo[];
  /** 重複・孤立の検出結果。 */
  advisor: {
    sameNameCount: number;
    similarCount: number;
    isolated: { name: string; reason: string }[];
  };
  /** アプリごとの ER 図(Mermaid)。 */
  erds: { app: string; mermaid: string }[];
  /** アプリごとの画面・API 数。 */
  appmaps: { app: string; pages: number; apis: number; flowchart: string }[];
  /** パッケージ間の依存(Mermaid)と、依存されている上位。 */
  depgraph: { mermaid: string; topDepended: { name: string; count: number }[] };
  /** リポジトリの構成(深さ 3 まで)。 */
  tree: RepoNode[];
}

export const PORTAL_EXTRAS: PortalExtras = ${JSON.stringify({
  generatedAt: catalog.generatedAt,
  health: catalog.health,
  adrs: catalog.adrs,
  advisor: catalog.advisor,
  erds: catalog.erds,
  appmaps: catalog.appmaps,
  depgraph: catalog.depgraph,
  tree,
})};
`;

writeFileSync(OUT, body, "utf8");
console.log(`✅ ${path.relative(ROOT, OUT)} を生成(ADR ${catalog.adrs.length} / ER図 ${catalog.erds.length} / 構成 ${tree.length} 件)`);
