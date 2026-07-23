"use client";
/**
 * CMS(記事管理)のデモ。版の差分・版戻し・公開申請の承認・予約公開・タグ一括操作。
 *
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import { Button, Input, Textarea, Badge, Alert, Separator, DatePicker } from "@platform/ui";
import {
  effectiveStatus,
  msUntilPublish,
  livePosts,
  scheduledPosts,
  // diffLines は diffRevisions が内部で使う(本文の差分は rd.body に入る)
  diffRevisions,
  validatePostInput,
  isValidSlug,
  buildPreviewUrl,
  summarizePosts,
  recentPosts,
  filterPosts,
  renameTagInPosts,
  mergeTagsInPosts,
  removeTagFromPosts,
  createMemoryPublishRequestStore,
  type CmsPost,
  type CmsPostInput,
  type PublishRequest,
  type EffectiveStatus,
} from "@platform/cms";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12 };

const STATUS_LABEL: Record<EffectiveStatus, string> = {
  draft: "下書き",
  scheduled: "予約公開",
  published: "公開中",
};

const STATUS_VARIANT: Record<EffectiveStatus, "secondary" | "warning" | "success"> = {
  draft: "secondary",
  scheduled: "warning",
  published: "success",
};

const POSTS: CmsPost[] = [
  {
    slug: "release-v2",
    title: "新バージョンをリリースしました",
    body: "# 新機能\n\n経費精算がスマホから使えるようになりました。\n\n## 使い方\n\nアプリを開いて「経費」→「撮影」を選んでください。",
    tags: ["リリース", "経費"],
    status: "published",
    publishedAt: "2026-07-10T00:00:00Z",
    updatedAt: "2026-07-10T09:00:00Z",
    categoryId: "news",
  },
  {
    slug: "roadmap-2027",
    title: "2027 年のロードマップ",
    body: "# 来年の計画\n\n公開日を待っています。",
    tags: ["リリース"],
    // ★status は published だが publishedAt が未来 → effectiveStatus は scheduled
    status: "published",
    publishedAt: "2026-07-20T00:00:00Z",
    updatedAt: "2026-07-14T15:00:00Z",
    categoryId: "news",
  },
  {
    slug: "interview-01",
    title: "現場の声: 情シスの一日",
    body: "# 朝の仕事\n\n出社してまず見るのは「今日やること」の画面です。",
    tags: ["インタビュー", "コラム"],
    status: "draft",
    updatedAt: "2026-07-13T11:00:00Z",
    categoryId: "column",
  },
];

/** 版の履歴（実物は RevisionStore に入る）。 */
const REVISIONS = [
  {
    version: 3,
    savedBy: "広報・鈴木",
    savedAt: "2026-07-10T09:00:00Z",
    title: "新バージョンをリリースしました",
    body: "# 新機能\n\n経費精算がスマホから使えるようになりました。\n\n## 使い方\n\nアプリを開いて「経費」→「撮影」を選んでください。",
    status: "published",
    categoryId: "news",
  },
  {
    version: 2,
    savedBy: "広報・鈴木",
    savedAt: "2026-07-09T17:00:00Z",
    title: "新バージョンをリリースしました",
    body: "# 新機能\n\n経費精算がスマホから使えます。\n\n## 使い方\n\nアプリの「経費」から。",
    status: "draft",
    categoryId: "news",
  },
  {
    version: 1,
    savedBy: "開発・山田",
    savedAt: "2026-07-08T10:00:00Z",
    title: "（仮）v2 リリースについて",
    body: "# 新機能\n\n経費精算がスマホ対応。",
    status: "draft",
    categoryId: undefined,
  },
];

export function CmsDemo() {
  const [now, setNow] = React.useState("2026-07-15");
  const [fromV, setFromV] = React.useState(1);
  const [toV, setToV] = React.useState(3);
  const [slug, setSlug] = React.useState("my-new-post");
  const [title, setTitle] = React.useState("新しい記事");
  const [body, setBody] = React.useState("本文です");
  const [requests, setRequests] = React.useState<PublishRequest[]>([]);

  const nowDate = React.useMemo(() => {
    const d = new Date(`${now}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [now]);

  const prStore = React.useMemo(
    () => createMemoryPublishRequestStore(() => `pr_${Math.random().toString(36).slice(2, 6)}`, () => new Date().toISOString()),
    [],
  );

  const summary = summarizePosts(POSTS, nowDate);
  const live = livePosts(POSTS, nowDate);
  const sched = scheduledPosts(POSTS, nowDate);
  const recent = recentPosts(POSTS, 3, nowDate);

  const from = REVISIONS.find((r) => r.version === fromV)!;
  const to = REVISIONS.find((r) => r.version === toV)!;
  const rd = diffRevisions(from, to);

  const input: CmsPostInput = { slug, title, body };
  const validated = validatePostInput(input);

  async function request(postSlug: string) {
    await prStore.request(postSlug, "広報・鈴木");
    setRequests(await prStore.list());
  }
  async function decide(id: string, status: "approved" | "rejected") {
    await prStore.decide(id, status, "情シス・山田", status === "approved" ? "内容を確認しました" : "日付を直してください");
    setRequests(await prStore.list());
  }

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>CMS（記事管理）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <strong>編集画面の基盤</strong>です。版の差分・版戻し・公開申請の承認・予約公開・タグの一括操作。
        <code>@platform/cms</code> は<strong>純ロジック</strong>で、画面と DB はアプリ側です
        （<code>createMemory*Store</code> と <code>createPrisma*Store</code> が対で用意されています）。
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-muted)" }}>
            今日
            <DatePicker value={now} onChange={(e) => setNow(e.target.value)} style={{ width: 150 }} />
          </label>
          <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
            <span>
              全 <b>{summary.total}</b>
            </span>
            <span style={{ color: "var(--color-success)" }}>
              公開 <b>{summary.published}</b>
            </span>
            <span style={{ color: "var(--color-warning)" }}>
              予約 <b>{summary.scheduled}</b>
            </span>
            <span style={{ color: "var(--color-muted)" }}>
              下書き <b>{summary.draft}</b>
            </span>
          </div>
        </div>

        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 5 }}>記事</th>
              <th style={{ padding: 5, width: 80 }}>status</th>
              <th style={{ padding: 5, width: 100 }}>実際の状態</th>
              <th style={{ padding: 5 }}>公開まで</th>
              <th style={{ padding: 5, width: 100 }}>公開申請</th>
            </tr>
          </thead>
          <tbody>
            {POSTS.map((p) => {
              const eff = effectiveStatus(p, nowDate);
              const until = msUntilPublish(p, nowDate);
              const pr = requests.find((r) => r.postSlug === p.slug);
              return (
                <tr key={p.slug} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 5 }}>{p.title}</td>
                  <td style={{ padding: 5, ...mono, color: "var(--color-muted)" }}>{p.status}</td>
                  <td style={{ padding: 5 }}>
                    <Badge variant={STATUS_VARIANT[eff]}>{STATUS_LABEL[eff]}</Badge>
                  </td>
                  <td style={{ padding: 5, fontSize: 12, color: "var(--color-muted)" }}>
                    {until !== null ? `${(until / 86400000).toFixed(1)} 日後` : "—"}
                  </td>
                  <td style={{ padding: 5 }}>
                    {pr === undefined ? (
                      <Button size="sm" variant="secondary" onClick={() => void request(p.slug)}>
                        申請する
                      </Button>
                    ) : (
                      <Badge variant={pr.status === "approved" ? "success" : pr.status === "rejected" ? "danger" : "warning"}>
                        {pr.status === "approved" ? "承認済" : pr.status === "rejected" ? "却下" : "承認待ち"}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <Alert variant="warning" title="2 行目に注目してください" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong><code>status</code> は <code>published</code> なのに、実際は「予約公開」です。</strong>
            <code>publishedAt</code> が未来だからで、<strong><code>status</code> だけ見ると誤解します</strong>。
            <br />
            <code>effectiveStatus()</code> が <code>status</code> と <code>publishedAt</code> を
            合わせて判断します。<strong>各画面で <code>if (post.status === &quot;published&quot;)</code> と書くと、
            予約記事が公開扱いになります</strong>——これが基盤に持つ理由です。
            <br />
            「今日」を <b>2026-07-25</b> にすると、自動で「公開中」に変わります。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>公開申請の承認フロー</h2>
        {requests.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-muted)" }}>上の「申請する」を押してください。</p>
        ) : (
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 5, ...mono, fontSize: 11, color: "var(--color-muted)" }}>{r.id}</td>
                  <td style={{ padding: 5 }}>{r.postSlug}</td>
                  <td style={{ padding: 5, fontSize: 12 }}>{r.requestedBy}</td>
                  <td style={{ padding: 5 }}>
                    <Badge variant={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warning"}>
                      {r.status === "approved" ? "承認済" : r.status === "rejected" ? "却下" : "承認待ち"}
                    </Badge>
                  </td>
                  <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>
                    {r.decidedBy !== undefined && `${r.decidedBy}: ${r.note ?? ""}`}
                  </td>
                  <td style={{ padding: 5 }}>
                    {r.status === "pending" && (
                      <span style={{ display: "flex", gap: 4 }}>
                        <Button size="sm" onClick={() => void decide(r.id, "approved")}>
                          承認
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => void decide(r.id, "rejected")}>
                          却下
                        </Button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>同じ記事で 2 回「申請する」を押しても、申請は増えません</strong>——
          <code>request()</code> の TSDoc に「<strong>既存の pending があればそれを返す</strong>」とあります。
          「承認待ちが 5 件並ぶ」を防ぎます。
          <br />
          「誰がいつ承認したか」が <code>decidedBy</code> / <code>decidedAt</code> に残るので、
          <code>/audit</code> と組み合わせれば監査に耐えます。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>版の差分（誰が何を変えたか）</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>比較</span>
          {REVISIONS.map((r) => (
            <Button key={r.version} size="sm" variant={fromV === r.version ? "primary" : "secondary"} onClick={() => setFromV(r.version)}>
              v{r.version}
            </Button>
          ))}
          <span style={{ color: "var(--color-muted)" }}>→</span>
          {REVISIONS.map((r) => (
            <Button key={r.version} size="sm" variant={toV === r.version ? "primary" : "secondary"} onClick={() => setToV(r.version)}>
              v{r.version}
            </Button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 8 }}>
          v{from.version}（{from.savedBy}・{from.savedAt.slice(0, 10)}） → v{to.version}（{to.savedBy}・{to.savedAt.slice(0, 10)}）
        </div>

        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginBottom: 10 }}>
          <tbody>
            {[
              { k: "タイトル", changed: rd.titleChanged, from: rd.titleFrom, to: rd.titleTo },
              { k: "状態", changed: rd.statusChanged, from: rd.statusFrom, to: rd.statusTo },
              { k: "カテゴリ", changed: rd.categoryChanged, from: rd.categoryFrom ?? "（なし）", to: rd.categoryTo ?? "（なし）" },
            ].map((r) => (
              <tr key={r.k} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, width: 80, color: "var(--color-muted)" }}>{r.k}</td>
                <td style={{ padding: 5 }}>
                  {r.changed ? (
                    <>
                      <span style={{ color: "var(--color-danger)", textDecoration: "line-through" }}>{r.from}</span>
                      <span style={{ margin: "0 6px", color: "var(--color-muted)" }}>→</span>
                      <span style={{ color: "var(--color-success)", fontWeight: 700 }}>{r.to}</span>
                    </>
                  ) : (
                    <span style={{ color: "var(--color-muted)" }}>変更なし</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 4 }}>
          本文{rd.bodyChanged ? `（${rd.body.filter((l) => l.type !== "same").length} 行が変更）` : "（変更なし）"}
        </div>
        <div style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, padding: "8px 4px", ...mono, lineHeight: 1.8 }}>
          {rd.body.map((l, i) => (
            <div
              key={i}
              style={{
                padding: "0 8px",
                background: l.type === "add" ? "color-mix(in srgb, var(--color-success) 14%, transparent)" : l.type === "del" ? "color-mix(in srgb, var(--color-danger) 12%, transparent)" : "transparent",
                color: l.type === "same" ? "var(--color-muted)" : undefined,
                whiteSpace: "pre-wrap",
              }}
            >
              <span style={{ display: "inline-block", width: 14, color: "var(--color-muted)" }}>
                {l.type === "add" ? "+" : l.type === "del" ? "−" : " "}
              </span>
              {l.text === "" ? " " : l.text}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setFromV(1);
              setToV(3);
            }}
          >
            v1 → v3（全体の変化）
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setFromV(2);
              setToV(2);
            }}
          >
            v2 → v2（同じ版）
          </Button>
        </div>

        <Alert variant="info" title="版を戻すには snapshotOf() / revisionToInput()" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <code>snapshotOf(post)</code> が今の内容を版として切り出し、
            <code>revisionToInput(rev, slug)</code> が版を<strong>編集フォームに戻せる形</strong>にします。
            <br />
            <strong>差分は LCS（最長共通部分列）で計算しています</strong>——
            単純に行を突き合わせると「1 行挿入しただけで全部が変更扱い」になります。
            「v1 → v3」で試してください。<strong>変わっていない行は白いまま</strong>です。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>入力の検証とプレビュー</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>slug</div>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>タイトル</div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
        </div>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} style={{ marginBottom: 10 }} />

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <Badge variant={isValidSlug(slug) ? "success" : "danger"}>slug: {isValidSlug(slug) ? "OK" : "NG"}</Badge>
          <Badge variant={validated.ok ? "success" : "danger"}>{validated.ok ? "保存できます" : validated.error}</Badge>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {["my-new-post", "日本語スラッグ", "Upper-Case", "with_underscore", ""].map((s) => (
            <Button key={s || "empty"} size="sm" variant="secondary" onClick={() => setSlug(s)}>
              {s === "" ? "（空）" : s}
            </Button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 4 }}>プレビュー URL（下書きを関係者に見せる）</div>
        <span style={{ ...mono, display: "block", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, padding: "6px 8px", wordBreak: "break-all" }}>
          {buildPreviewUrl("https://example.co.jp", slug, "tok_abc123")}
        </span>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.8 }}>
          <strong>プレビューにトークンが要るのが要点です。</strong>
          <code>/preview/my-post</code> だけだと、<strong>URL を知っていれば誰でも下書きが読めます</strong>。
          <br />
          slug は<strong>英小文字・数字・ハイフンのみ</strong>。日本語や大文字を試してください。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>タグの一括操作</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.8 }}>
          <strong>タグは必ず表記がゆれます</strong>——「リリース」「release」「リリース情報」。
          記事を 1 件ずつ直すのは現実的ではありません。
        </p>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 4 }}>操作</th>
              <th style={{ padding: 4 }}>結果（変更のあった記事だけ返る）</th>
            </tr>
          </thead>
          <tbody>
            {[
              { k: 'renameTagInPosts(posts, "リリース", "お知らせ")', v: renameTagInPosts(POSTS, "リリース", "お知らせ") },
              { k: 'mergeTagsInPosts(posts, ["リリース", "経費"], "製品情報")', v: mergeTagsInPosts(POSTS, ["リリース", "経費"], "製品情報") },
              { k: 'removeTagFromPosts(posts, "コラム")', v: removeTagFromPosts(POSTS, "コラム") },
            ].map((r) => (
              <tr key={r.k} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 4, ...mono, fontSize: 11, width: 280 }}>{r.k}</td>
                <td style={{ padding: 4, ...mono, fontSize: 11 }}>
                  {r.v.map((x) => `${x.slug}: [${x.tags.join(", ")}]`).join(" / ") || "（変更なし）"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>変更のあった記事だけが返ります</strong>——全件を返すと、
          <strong>関係ない記事まで <code>updatedAt</code> が動きます</strong>（「更新順」の並びが壊れる）。
          <br />
          <code>mergeTagsInPosts</code> は<strong>重複を潰します</strong>——
          「リリース」と「経費」を両方持つ記事は、統合後に「製品情報」が 1 つだけになります。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>最近更新した記事</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {recent.map((r) => (
              <tr key={r.slug} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5 }}>{r.title}</td>
                <td style={{ padding: 5, ...mono, color: "var(--color-muted)", width: 150 }}>{r.updatedAt.slice(0, 16).replace("T", " ")}</td>
                <td style={{ padding: 5, width: 80 }}>
                  <Badge variant="outline">{r.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Separator style={{ margin: "12px 0" }} />

        <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8, margin: 0 }}>
          <strong>公開中 {live.length} 件 / 予約 {sched.length} 件</strong>（
          <code>livePosts()</code> / <code>scheduledPosts()</code>）。
          <code>filterPosts()</code> で状態・タグ・カテゴリの絞り込みもできます（
          公開かつ「リリース」タグ = {filterPosts(POSTS, { status: "published", tag: "リリース" }, nowDate).length} 件）。
          <br />
          <br />
          <strong>この基盤は画面を持ちません。</strong>
          <code>createMemoryCmsStore()</code>（テスト用）と <code>createPrismaCmsStore(db)</code>（本番）が
          対で用意されているので、<strong>DB 無しでロジックのテストが書けます</strong>。
          実物の編集画面は <code>apps/internal-app/src/app/cms</code>、公開側は{" "}
          <a href="/apps/site" style={{ color: "var(--color-primary)" }}>公開サイトのデモ</a>です。
        </p>
      </div>
    </>
  );
}
