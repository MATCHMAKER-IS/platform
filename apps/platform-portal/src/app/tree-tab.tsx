"use client";
/**
 * 「構成」タブ。リポジトリのフォルダ構成を、**何を置く場所かの説明付き**で見せる。
 *
 * 初めて触る人が最初に詰まるのは「この機能はどこに書けばいいのか」で、
 * それは資料を読まないと分からない状態だった。構成を眺めるだけで
 * 「ここは基盤だから触らない」「業務ロジックはここ」が分かるようにする。
 * @packageDocumentation
 */
import * as React from "react";
import { Button, Input, Tree, collectAllIds, type TreeNode } from "@platform/ui";

/** API が返すノード(server/tree.ts の RepoNode と同じ形)。 */
interface RepoNode {
  id: string;
  name: string;
  kind: "dir" | "file";
  note?: string;
  edit?: "app" | "caution" | "generated";
  children?: RepoNode[];
  truncated?: number;
}

/**
 * 触ってよいかの表示。
 *
 * 色は**テーマ切り替えに追従させる**ためトークンを使う(直書きすると濃色テーマで読めなくなる)。
 * 使えるトークンは tokens.css にあるものだけ —— success / warning は無いので、
 * 注意は danger、推奨は primary で表す。
 */
const EDIT_LABEL: Record<NonNullable<RepoNode["edit"]>, { text: string; color: string }> = {
  app: { text: "ここに書く", color: "var(--color-primary)" },
  caution: { text: "別 PR で", color: "var(--color-danger)" },
  generated: { text: "自動生成", color: "var(--color-muted)" },
};

/** 検索語に一致するか(パスと説明の両方を見る)。 */
function matches(node: RepoNode, query: string): boolean {
  return node.id.toLowerCase().includes(query) || (node.note ?? "").toLowerCase().includes(query);
}

/**
 * 検索語に一致する枝だけ残す。
 *
 * 一致した節の**祖先も残す**。残さないと、見つかったファイルがどこにあるのか
 * 分からなくなる(パスの途中が消えたツリーは読めない)。
 */
function filterTree(nodes: RepoNode[], query: string): RepoNode[] {
  const out: RepoNode[] = [];
  for (const node of nodes) {
    const kids = node.children ? filterTree(node.children, query) : [];
    if (kids.length > 0) out.push({ ...node, children: kids });
    else if (matches(node, query)) out.push({ ...node, children: undefined });
  }
  return out;
}

/** RepoNode を、基盤の Tree が受け取る形に詰め替える。 */
function toTreeNodes(nodes: RepoNode[]): TreeNode[] {
  return nodes.map((node) => ({
    id: node.id,
    label: <NodeLabel node={node} />,
    data: node,
    ...(node.children !== undefined && { children: toTreeNodes(node.children) }),
  }));
}

function NodeLabel({ node }: { node: RepoNode }) {
  const badge = node.edit !== undefined ? EDIT_LABEL[node.edit] : undefined;
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontWeight: node.kind === "dir" ? 600 : 400, fontFamily: node.kind === "file" ? "monospace" : undefined }}>
        {node.name}
        {node.kind === "dir" ? "/" : ""}
      </span>
      {badge !== undefined && (
        <span style={{ fontSize: 10, color: badge.color, border: `1px solid ${badge.color}`, borderRadius: 8, padding: "0 6px", whiteSpace: "nowrap" }}>
          {badge.text}
        </span>
      )}
      {node.note !== undefined && (
        <span style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.6 }}>{node.note}</span>
      )}
      {node.truncated !== undefined && (
        <span style={{ fontSize: 11, color: "var(--color-muted)" }}>… ほか {node.truncated} 件</span>
      )}
    </span>
  );
}

/**
 * 構成タブ。
 *
 * 読み込みは**このタブを開いたときだけ**行う(1,700 件あり、カタログと一緒に
 * 配ると全員が毎回読むことになる)。
 *
 * @param props.fetchImpl テスト用に fetch を差し替える
 */
export function TreeTab({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [nodes, setNodes] = React.useState<RepoNode[] | null>(null);
  const [error, setError] = React.useState("");
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<RepoNode | null>(null);

  React.useEffect(() => {
    void (async () => {
      try {
        const r = await doFetch("/api/tree");
        if (!r.ok) throw new Error(String(r.status));
        const body = (await r.json()) as { nodes: RepoNode[] };
        setNodes(body.nodes);
      } catch {
        setError("構成の取得に失敗しました");
      }
    })();
  }, [doFetch]);

  if (error !== "") return <p style={{ color: "var(--color-muted)" }}>{error}</p>;
  if (nodes === null) return <p style={{ color: "var(--color-muted)" }}>読み込み中…</p>;

  const query = q.trim().toLowerCase();
  const shown = query === "" ? nodes : filterTree(nodes, query);
  const treeNodes = toTreeNodes(shown);
  // 検索中は全部開く。畳んだままでは「何件見つかったか」しか分からない。
  // Tree の展開は初期値なので、検索語を key にして初期状態から作り直す
  const expanded = query === "" ? ["packages", "apps"] : collectAllIds(treeNodes);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <Input
          value={q}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
          placeholder="フォルダ名・説明で検索（例: server, 認可, 生成）"
          style={{ flex: 1, minWidth: 260 }}
        />
        {query !== "" && <Button variant="secondary" onClick={() => setQ("")}>クリア</Button>}
      </div>

      <p style={{ color: "var(--color-muted)", fontSize: 12, margin: "0 0 12px", lineHeight: 1.8 }}>
        <strong>ここに書く</strong>＝業務ロジックの置き場、<strong>別 PR で</strong>＝基盤（アプリ作業と混ぜない）。
        ファイル名まで出しているのは <code>packages/&lt;名前&gt;/src/</code> の 1 段目まで。
      </p>

      {selected !== null && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <code style={{ fontSize: 13, color: "var(--color-primary)" }}>{selected.id}</code>
          {selected.note !== undefined && (
            <p style={{ fontSize: 12.5, color: "var(--color-fg)", margin: "6px 0 0", lineHeight: 1.7 }}>{selected.note}</p>
          )}
        </div>
      )}

      {treeNodes.length === 0 ? (
        <p style={{ color: "var(--color-muted)" }}>該当する場所がありません。</p>
      ) : (
        <Tree
          key={query}
          nodes={treeNodes}
          defaultExpandedIds={expanded}
          selectedId={selected?.id}
          onSelect={(node) => setSelected(node.data as RepoNode)}
        />
      )}
    </div>
  );
}
