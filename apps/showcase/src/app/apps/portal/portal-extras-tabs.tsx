"use client";
/**
 * 基盤ポータルの付加情報タブ(構成・ヘルス・ADR・Advisor・設計)。
 *
 * **apps/platform-portal から移設。** 元は開発者向けの単独アプリだったが、
 * デプロイ単位・担当者・利用者のどれも showcase と同じで、
 * 同じものを 2 か所で保守する理由が無かった(ADR-0015)。
 *
 * データは生成物(`portal-extras.generated.ts`)から受け取る。
 * **実行時にファイルを読まない**(配置によって壊れるため)。
 * @packageDocumentation
 */
import * as React from "react";
import { Badge, Button, Alert, EmptyState, DescriptionList } from "@platform/ui";
import type { PortalExtras, RepoNode } from "../../../lib/portal-extras.generated";

/** タブの種類。 */
type Tab = "health" | "tree" | "adr" | "advisor" | "design";

/** タブの表示名。 */
const TAB_LABELS: { key: Tab; label: string }[] = [
  { key: "health", label: "ヘルス" },
  { key: "tree", label: "構成" },
  { key: "adr", label: "ADR" },
  { key: "advisor", label: "Advisor" },
  { key: "design", label: "設計" },
];

/** ADR の状態に応じた見た目。**却下されたものを採用済みと同じ色で出さない。** */
// **`Badge` の variant に合わせる。** `destructive` は shadcn の名前で、
// この基盤の `Badge` は `danger` を使う(2026-08 の型検査で発覚)。
function adrVariant(status: string): "default" | "secondary" | "danger" {
  if (status.includes("却下") || status.includes("Rejected")) return "danger";
  if (status.includes("採用") || status.includes("Accepted")) return "default";
  return "secondary";
}

/** ディレクトリツリーの 1 段。**再帰で描く**(深さは生成側で 3 に絞ってある)。 */
function TreeBranch({ nodes, depth = 0 }: { nodes: RepoNode[]; depth?: number }) {
  return (
    <ul className={depth === 0 ? "space-y-1" : "ml-4 space-y-1 border-l border-[var(--color-border)] pl-3"}>
      {nodes.map((n) => (
        <li key={n.id}>
          <span className="font-mono text-sm">
            {n.kind === "dir" ? "📁" : "📄"} {n.name}
          </span>
          {n.children !== undefined && n.children.length > 0 && (
            <TreeBranch nodes={n.children} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

/** Mermaid の図。**描画はしない**(ライブラリを足すとデモが重くなる)。 */
function MermaidBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-[var(--radius)] bg-[var(--color-muted-bg)] p-3 text-xs">
      {code}
    </pre>
  );
}

/** 付加情報のタブ。 */
export function PortalExtrasTabs({ extras }: { extras: PortalExtras }) {
  const [tab, setTab] = React.useState<Tab>("health");

  return (
    <section className="mx-auto max-w-4xl px-4 pb-12">
      <div className="mb-3 flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-2">
        {TAB_LABELS.map((t) => (
          <Button
            key={t.key}
            variant="tab"
            data-state={tab === t.key ? "active" : undefined}
            size="sm"
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === "adr" && ` (${extras.adrs.length})`}
          </Button>
        ))}
      </div>

      <p className="mb-4 text-xs text-[var(--color-muted)]">
        生成: {extras.generatedAt}(`pnpm gen:all` で更新されます)
      </p>

      {tab === "health" && (
        <DescriptionList items={extras.health.map((h) => ({ label: h.label, value: h.value }))} />
      )}

      {tab === "tree" && (
        <>
          <Alert className="mb-3">
            深さ 3 までを表示しています。**全部を載せると生成物が数 MB になり、
            画面の読み込みが目に見えて遅くなる**ためです(見たいのは全体の形なので十分)。
          </Alert>
          <TreeBranch nodes={extras.tree} />
        </>
      )}

      {tab === "adr" && (
        <ul className="space-y-2">
          {extras.adrs.map((a) => (
            <li key={a.id} className="rounded-[var(--radius)] border border-[var(--color-border)] p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-[var(--color-muted)]">{a.id}</span>
                <Badge variant={adrVariant(a.status)}>{a.status}</Badge>
              </div>
              <p className="mt-1 text-sm">{a.title}</p>
            </li>
          ))}
        </ul>
      )}

      {tab === "advisor" && (
        <div className="space-y-4">
          <DescriptionList
            items={[
              { label: "同名の関数", value: `${extras.advisor.sameNameCount} 件` },
              { label: "似た名前の関数", value: `${extras.advisor.similarCount} 件` },
              { label: "どこからも使われていない", value: `${extras.advisor.isolated.length} 件` },
            ]}
          />
          {extras.advisor.isolated.length === 0 ? (
            <EmptyState title="孤立したパッケージはありません" />
          ) : (
            <ul className="space-y-2">
              {extras.advisor.isolated.map((p) => (
                <li key={p.name} className="rounded-[var(--radius)] border border-[var(--color-border)] p-3">
                  <span className="font-medium">{p.name}</span>
                  <p className="text-sm text-[var(--color-muted)]">{p.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "design" && (
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold">パッケージ間の依存</h3>
            <p className="mb-2 text-sm text-[var(--color-muted)]">
              依存されている上位:{" "}
              {extras.depgraph.topDepended.slice(0, 5).map((d) => `${d.name}(${d.count})`).join(" / ")}
            </p>
            <MermaidBlock code={extras.depgraph.mermaid} />
          </div>
          {extras.erds.map((e) => (
            <div key={e.app}>
              <h3 className="mb-2 text-sm font-semibold">{e.app} の ER 図</h3>
              <MermaidBlock code={e.mermaid} />
            </div>
          ))}
          <div>
            <h3 className="mb-2 text-sm font-semibold">アプリの規模</h3>
            <DescriptionList
              items={extras.appmaps.map((a) => ({
                label: a.app,
                value: `画面 ${a.pages} / API ${a.apis}`,
              }))}
            />
          </div>
        </div>
      )}
    </section>
  );
}
