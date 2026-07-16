import { describe, it, expect } from "vitest";
import { createThread, createPost, canReply, rootPosts, repliesOf, extractMentions } from "./post";
import { toggleReaction, countReactions, userReactions } from "./reaction";
import { summarize, sortThreads, filterByTag, searchThreads } from "./thread-list";

describe("post", () => {
  it("スレッド/投稿の検証と trim", () => {
    expect(createThread({ id: "x", title: "  ", authorId: "u" }).ok).toBe(false);
    const t = createThread({ id: "t", title: "  お知らせ  ", authorId: "u", tags: ["総務"] });
    expect(t.ok && t.thread.title).toBe("お知らせ");
    expect(createPost({ id: "x", authorId: "u", body: "" }).ok).toBe(false);
  });
  it("施錠で返信不可、本文/返信の分離", () => {
    expect(canReply({ id: "t", title: "x", authorId: "u", createdAt: "t", locked: true })).toBe(false);
    const posts = [{ id: "p1", authorId: "u", body: "b", createdAt: "2025-07-01T10:00:00Z" }, { id: "p2", authorId: "u", body: "r", createdAt: "2025-07-01T11:00:00Z", replyTo: "p1" }];
    expect(rootPosts(posts).length).toBe(1);
    expect(repliesOf(posts, "p1").length).toBe(1);
    expect(extractMentions("@u1 @u2 @u1")).toEqual(["u1", "u2"]);
  });
});

describe("reaction", () => {
  it("トグル・集計・自分の状態", () => {
    let rx: { postId: string; userId: string; kind: string }[] = [];
    rx = toggleReaction(rx, { postId: "p1", userId: "u1", kind: "like" });
    rx = toggleReaction(rx, { postId: "p1", userId: "u2", kind: "like" });
    expect(countReactions(rx, "p1").like).toBe(2);
    rx = toggleReaction(rx, { postId: "p1", userId: "u1", kind: "like" });
    expect(countReactions(rx, "p1").like).toBe(1);
    expect(userReactions(rx, "p1", "u2")).toEqual(["like"]);
  });
});

describe("thread-list", () => {
  const posts = [{ id: "p1", authorId: "u1", body: "本文", createdAt: "2025-07-01T10:00:00Z" }, { id: "p2", authorId: "u2", body: "返信", createdAt: "2025-07-01T12:00:00Z", replyTo: "p1" }];
  it("要約・ピン優先整列・タグ/検索", () => {
    const t = { id: "t1", title: "お知らせ", authorId: "u1", createdAt: "2025-07-01T00:00:00Z", tags: ["総務"] };
    const sum = summarize(t, posts);
    expect(sum.replyCount).toBe(1);
    expect(sum.participants).toBe(2);
    const pinned = summarize({ id: "t2", title: "重要", authorId: "u1", createdAt: "2025-06-01T00:00:00Z", pinned: true }, []);
    expect(sortThreads([sum, pinned])[0]?.thread.id).toBe("t2");
    expect(filterByTag([sum], "総務").length).toBe(1);
    expect(searchThreads([sum], { t1: posts }, "返信").length).toBe(1);
  });
});
