import { describe, it, expect } from "vitest";
import {
  isValidSlug, validatePostInput, toPost, isPublishAction,
  effectiveStatus, isLive, livePosts, scheduledPosts, msUntilPublish,
  filterPosts, renameTagInPosts, mergeTagsInPosts, removeTagFromPosts,
  diffLines, diffRevisions, summarizePosts, recentPosts,
  snapshotOf, revisionToInput, buildPreviewUrl,
  cmsPostToBlog, liveBlogViews,
  isValidPageSlug, isAnnouncementLevel, validateAnnouncementInput,
  type CmsPost,
} from "./index";

/** 記事を 1 件作る。 */
const post = (over: Partial<CmsPost> = {}): CmsPost => ({
  slug: "hello", title: "こんにちは", body: "本文", tags: [],
  status: "published", publishedAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z",
  ...over,
});

const NOW = new Date("2026-07-29T00:00:00Z");

describe("isValidSlug", () => {
  it("英小文字・数字・ハイフンを許す", () => {
    expect(isValidSlug("hello-world-2")).toBe(true);
    expect(isValidSlug("a")).toBe(true);
  });

  it("**URL を壊す形は拒否する**", () => {
    expect(isValidSlug("Hello")).toBe(false);      // 大文字
    expect(isValidSlug("こんにちは")).toBe(false);  // 日本語
    expect(isValidSlug("a b")).toBe(false);        // 空白
    expect(isValidSlug("a/b")).toBe(false);        // パス区切り
    expect(isValidSlug("")).toBe(false);
  });

  it("ハイフンの位置が不正なものは拒否", () => {
    expect(isValidSlug("-lead")).toBe(false);
    expect(isValidSlug("trail-")).toBe(false);
    expect(isValidSlug("a--b")).toBe(false);
  });
});

describe("validatePostInput", () => {
  const input = { slug: "hello", title: "題", body: "本文" };

  it("妥当なら ok", () => {
    expect(validatePostInput(input).ok).toBe(true);
  });

  it("slug・タイトル・本文は必須", () => {
    expect(validatePostInput({ ...input, slug: "" }).ok).toBe(false);
    expect(validatePostInput({ ...input, title: "  " }).ok).toBe(false);
    expect(validatePostInput({ ...input, body: "  " }).ok).toBe(false);
  });

  it("不正な公開日時を弾く", () => {
    expect(validatePostInput({ ...input, publishedAt: "いつか" }).ok).toBe(false);
    expect(validatePostInput({ ...input, publishedAt: "2026-07-01T00:00:00Z" }).ok).toBe(true);
  });

  it("理由を文字列で返す(画面にそのまま出せる)", () => {
    const r = validatePostInput({ ...input, slug: "Bad Slug" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.length).toBeGreaterThan(0);
  });
});

describe("toPost", () => {
  it("**公開時は publishedAt をその瞬間に確定させる**", () => {
    const p = toPost({ slug: "a", title: "t", body: "b", status: "published" }, "2026-07-29T00:00:00Z");
    expect(p.publishedAt).toBe("2026-07-29T00:00:00Z");
  });

  it("予約公開なら指定日時をそのまま使う", () => {
    const p = toPost({ slug: "a", title: "t", body: "b", status: "published", publishedAt: "2026-08-01T00:00:00Z" }, "2026-07-29T00:00:00Z");
    expect(p.publishedAt).toBe("2026-08-01T00:00:00Z");
  });

  it("既定は下書き", () => {
    expect(toPost({ slug: "a", title: "t", body: "b" }, "2026-07-29T00:00:00Z").status).toBe("draft");
  });

  it("**下書きには publishedAt を勝手に付けない**(公開扱いにならないように)", () => {
    expect(toPost({ slug: "a", title: "t", body: "b" }, "2026-07-29T00:00:00Z").publishedAt).toBeUndefined();
  });

  it("任意項目は指定したときだけ持たせる", () => {
    const p = toPost({ slug: "a", title: "t", body: "b" }, "2026-07-29T00:00:00Z");
    expect("excerpt" in p).toBe(false);
    expect(toPost({ slug: "a", title: "t", body: "b", excerpt: "要約" }, "2026-07-29T00:00:00Z").excerpt).toBe("要約");
  });

  it("tags は未指定なら空配列(undefined にしない)", () => {
    expect(toPost({ slug: "a", title: "t", body: "b" }, "2026-07-29T00:00:00Z").tags).toEqual([]);
  });
});

describe("公開判定(漏れると事故になる)", () => {
  it("下書きは実効ステータスも draft", () => {
    expect(effectiveStatus(post({ status: "draft" }), NOW)).toBe("draft");
  });

  it("**予約日時を過ぎたら published として扱う**(バッチが動いていなくても正しい)", () => {
    expect(effectiveStatus(post({ publishedAt: "2026-07-01T00:00:00Z" }), NOW)).toBe("published");
  });

  it("予約日時が未来なら scheduled", () => {
    expect(effectiveStatus(post({ publishedAt: "2026-08-01T00:00:00Z" }), NOW)).toBe("scheduled");
  });

  it("publishedAt が無い published はそのまま公開中", () => {
    const p = post();
    delete (p as { publishedAt?: string }).publishedAt;
    expect(effectiveStatus(p, NOW)).toBe("published");
  });

  it("**下書き・予約前は読者に見せない**", () => {
    expect(isLive(post({ status: "draft" }), NOW)).toBe(false);
    expect(isLive(post({ publishedAt: "2026-08-01T00:00:00Z" }), NOW)).toBe(false);
    expect(isLive(post(), NOW)).toBe(true);
  });

  it("livePosts は公開中だけを新しい順で返す", () => {
    const posts = [
      post({ slug: "old", publishedAt: "2026-06-01T00:00:00Z" }),
      post({ slug: "draft", status: "draft" }),
      post({ slug: "new", publishedAt: "2026-07-20T00:00:00Z" }),
      post({ slug: "future", publishedAt: "2026-08-01T00:00:00Z" }),
    ];
    expect(livePosts(posts, NOW).map((p) => p.slug)).toEqual(["new", "old"]);
  });

  it("scheduledPosts は**公開が近い順**(次に何が出るか)", () => {
    const posts = [
      post({ slug: "later", publishedAt: "2026-09-01T00:00:00Z" }),
      post({ slug: "soon", publishedAt: "2026-08-01T00:00:00Z" }),
      post({ slug: "live", publishedAt: "2026-07-01T00:00:00Z" }),
    ];
    expect(scheduledPosts(posts, NOW).map((p) => p.slug)).toEqual(["soon", "later"]);
  });

  it("msUntilPublish は予約中だけ残り時間を返す", () => {
    expect(msUntilPublish(post({ publishedAt: "2026-07-29T01:00:00Z" }), NOW)).toBe(3_600_000);
  });

  it("**過ぎたもの・予約でないものは null**(「あと -3 時間」と出さない)", () => {
    expect(msUntilPublish(post({ publishedAt: "2026-07-01T00:00:00Z" }), NOW)).toBe(null);
    expect(msUntilPublish(post({ status: "draft" }), NOW)).toBe(null);
  });
});

describe("filterPosts", () => {
  const posts = [
    post({ slug: "a", title: "経費の申請", tags: ["経費"], categoryId: "c1" }),
    post({ slug: "b", title: "勤怠の記録", tags: ["勤怠"], categoryId: "c2" }),
    post({ slug: "c", title: "経費の精算", tags: ["経費", "会計"], categoryId: "c2", status: "draft" }),
  ];

  it("キーワードで絞る(大文字小文字は無視)", () => {
    expect(filterPosts(posts, { query: "経費" }, NOW).map((p) => p.slug)).toEqual(["a", "c"]);
  });

  it("カテゴリ・タグで絞る", () => {
    expect(filterPosts(posts, { categoryId: "c2" }, NOW).map((p) => p.slug)).toEqual(["b", "c"]);
    expect(filterPosts(posts, { tag: "会計" }, NOW).map((p) => p.slug)).toEqual(["c"]);
  });

  it("**実効ステータス**で絞る(DB の status ではない)", () => {
    expect(filterPosts(posts, { status: "draft" }, NOW).map((p) => p.slug)).toEqual(["c"]);
  });

  it("複数条件は AND", () => {
    expect(filterPosts(posts, { query: "経費", categoryId: "c2" }, NOW).map((p) => p.slug)).toEqual(["c"]);
  });

  it("条件なしなら全件・元の順序を保つ", () => {
    expect(filterPosts(posts, {}, NOW).map((p) => p.slug)).toEqual(["a", "b", "c"]);
  });
});

describe("タグの一括操作", () => {
  const posts = [
    post({ slug: "a", tags: ["経費", "会計"] }),
    post({ slug: "b", tags: ["勤怠"] }),
    post({ slug: "c", tags: ["経費精算"] }),
  ];

  it("**変更が必要な記事だけ返す**(全件更新すると更新日時が汚れる)", () => {
    const changed = renameTagInPosts(posts, "経費", "経費精算");
    expect(changed.map((c) => c.slug)).toEqual(["a"]);
  });

  it("リネーム時に重複を除く", () => {
    const dup = [post({ slug: "x", tags: ["経費", "経費精算"] })];
    expect(renameTagInPosts(dup, "経費", "経費精算")[0]?.tags).toEqual(["経費精算"]);
  });

  it("複数タグを 1 つに統合する(表記ゆれを揃える)", () => {
    const changed = mergeTagsInPosts(posts, ["経費", "経費精算"], "経費");
    expect(changed.map((c) => c.slug)).toEqual(["c"]);
    expect(changed[0]?.tags).toEqual(["経費"]);
  });

  it("**統合しても結果が変わらない記事は返さない**", () => {
    // 統合元に統合先そのものが含まれるとき、既に統合先だけの記事は何も変わらない。
    // 返すと呼び出し側が保存し、中身が同じまま updatedAt だけ進む
    const already = [post({ slug: "x", tags: ["経費", "会計"] })];
    expect(mergeTagsInPosts(already, ["経費", "経費精算"], "経費")).toEqual([]);
  });

  it("タグを削除する", () => {
    const changed = removeTagFromPosts(posts, "会計");
    expect(changed.map((c) => c.slug)).toEqual(["a"]);
    expect(changed[0]?.tags).toEqual(["経費"]);
  });

  it("該当が無ければ空(何も更新しない)", () => {
    expect(renameTagInPosts(posts, "存在しない", "x")).toEqual([]);
    expect(removeTagFromPosts(posts, "存在しない")).toEqual([]);
  });
});

describe("差分", () => {
  it("行単位で追加・削除・据え置きを返す", () => {
    const d = diffLines("a\nb\nc", "a\nx\nc");
    expect(d.some((l) => l.type === "add")).toBe(true);
    expect(d.some((l) => l.type === "del")).toBe(true);
    expect(d.some((l) => l.type === "same")).toBe(true);
  });

  it("同じテキストなら差分は据え置きだけ", () => {
    expect(diffLines("a\nb", "a\nb").every((l) => l.type === "same")).toBe(true);
  });

  it("diffRevisions はタイトル・本文・タグの変化を示す", () => {
    // **`status` は `RevisionLike` の必須項目**(`tags` は持たない)。
    // 型検査が回っていなかったため、実型と食い違ったまま通っていた(2026-08)
    const before = { title: "旧", body: "本文", status: "draft" };
    const after = { title: "新", body: "本文", status: "draft" };
    const d = diffRevisions(before, after);
    expect(d.bodyChanged).toBe(false);
    expect(JSON.stringify(d)).toContain("新");
  });
});

describe("集計", () => {
  const posts = [
    post({ slug: "a" }),
    post({ slug: "b", status: "draft" }),
    post({ slug: "c", publishedAt: "2026-08-01T00:00:00Z" }),
  ];

  it("**実効ステータスで数える**(予約日時を過ぎたものは公開中)", () => {
    const s = summarizePosts(posts, NOW);
    expect(s.published).toBe(1);
    expect(s.draft).toBe(1);
    expect(s.scheduled).toBe(1);
  });

  it("recentPosts は更新の新しい順に上位 N 件", () => {
    const list = [
      post({ slug: "old", updatedAt: "2026-07-01T00:00:00Z" }),
      post({ slug: "new", updatedAt: "2026-07-28T00:00:00Z" }),
    ];
    expect(recentPosts(list, 1, NOW).map((p) => p.slug)).toEqual(["new"]);
  });
});

describe("リビジョン", () => {
  it("snapshotOf は記事の内容を切り出す", () => {
    const snap = snapshotOf(post({ title: "題", body: "本文" }));
    expect(snap.title).toBe("題");
    expect(snap.body).toBe("本文");
  });

  it("**復元は下書きとして戻す**(いきなり公開しない)", () => {
    const input = revisionToInput(
      // **`status` は `Revision` の必須項目**。型検査が回っていなかったため、
      // 実型と食い違ったまま通っていた(2026-08)
      { id: "r1", postSlug: "hello", version: 1, title: "旧題", body: "旧本文", tags: [], status: "published", savedBy: "u1", savedAt: "2026-07-01T00:00:00Z" },
      "hello",
    );
    expect(input.status).toBe("draft");
    expect(input.title).toBe("旧題");
  });
});

describe("プレビュー URL", () => {
  it("slug とトークンを含む URL を組み立てる", () => {
    const url = buildPreviewUrl("https://example.com", "hello", "tok123");
    expect(url).toContain("hello");
    expect(url).toContain("tok123");
  });
});

describe("公開サイト向けの変換", () => {
  it("**管理用の項目(status)を落とす**(内部情報を渡さない)", () => {
    const view = cmsPostToBlog(post({ status: "published" }));
    expect("status" in view).toBe(false);
    expect(view.slug).toBe("hello");
  });

  it("liveBlogViews は公開中だけを新しい順で返す", () => {
    const posts = [post({ slug: "a" }), post({ slug: "d", status: "draft" })];
    expect(liveBlogViews(posts, NOW).map((v) => v.slug)).toEqual(["a"]);
  });
});

describe("ページ・お知らせ", () => {
  it("**ページの slug は空文字を許す**(トップページ)", () => {
    // 記事の slug とはここが違う
    expect(isValidPageSlug("")).toBe(true);
    expect(isValidSlug("")).toBe(false);
    expect(isValidPageSlug("about")).toBe(true);
    expect(isValidPageSlug("About Us")).toBe(false);
  });

  it("isAnnouncementLevel は DB 由来の未検証値を絞り込む", () => {
    expect(isAnnouncementLevel("info")).toBe(true);
    expect(isAnnouncementLevel("warning")).toBe(true);
    expect(isAnnouncementLevel("sale")).toBe(true);
    expect(isAnnouncementLevel("danger")).toBe(false);
    expect(isAnnouncementLevel(null)).toBe(false);
    expect(isAnnouncementLevel(1)).toBe(false);
  });

  it("お知らせの入力を検証する(**配列ではなく Result を返す**)", () => {
    // TSDoc は「問題の一覧」と書いていたが実際は Result。
    // 配列だと思って .length を見ると undefined になり、常に妥当と読めてしまう
    expect(validateAnnouncementInput({ message: "お知らせ" }).ok).toBe(true);
    expect(validateAnnouncementInput({ message: "  " }).ok).toBe(false);
  });
});

describe("isPublishAction", () => {
  it("公開を伴う入力を見分ける(権限チェックに使う)", () => {
    expect(isPublishAction({ slug: "a", title: "t", body: "b", status: "published" })).toBe(true);
    expect(isPublishAction({ slug: "a", title: "t", body: "b", status: "draft" })).toBe(false);
    expect(isPublishAction({ slug: "a", title: "t", body: "b" })).toBe(false);
  });
});
