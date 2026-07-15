import { describe, it, expect } from "vitest";
import { createMessage, editMessage, sortMessages, groupByDate, extractMentions, mentionsOf, repliesTo } from "./message.js";
import { createRoom, lastMessage, unreadCount, markRead, firstUnread, sortRoomsByActivity } from "./room.js";

const M = (id: string, senderId: string, at: string, text = "x") => ({ id, roomId: "r1", senderId, text, at });

describe("message", () => {
  it("空・長すぎは失敗、trim して成功", () => {
    expect(createMessage({ id: "x", roomId: "r", senderId: "u", text: "   " }).ok).toBe(false);
    expect(createMessage({ id: "x", roomId: "r", senderId: "u", text: "a".repeat(5000) }).ok).toBe(false);
    const r = createMessage({ id: "m", roomId: "r", senderId: "u", text: "  hi  " });
    expect(r.ok && r.message.text).toBe("hi");
  });
  it("editMessage は editedAt を設定", () => {
    const r = createMessage({ id: "m", roomId: "r", senderId: "u", text: "a", at: "t" });
    const e = r.ok ? editMessage(r.message, "b", "t2") : { ok: false as const, error: "" };
    expect(e.ok && e.message.editedAt).toBe("t2");
  });
  it("時系列整列・日付グループ・メンション", () => {
    const msgs = [M("a", "u1", "2025-07-02T09:00:00Z"), M("b", "u2", "2025-07-01T09:00:00Z", "@bob")];
    expect(sortMessages(msgs).map((m) => m.id).join("")).toBe("ba");
    expect(groupByDate(msgs).length).toBe(2);
    expect(extractMentions("@bob @al @bob")).toEqual(["bob", "al"]);
    expect(mentionsOf(msgs, "bob").length).toBe(1);
  });
  it("repliesTo はスレッド返信を返す", () => {
    expect(repliesTo([{ ...M("r", "u", "t"), replyTo: "m1" }], "m1").length).toBe(1);
  });
});

describe("room", () => {
  const msgs = [M("a", "u1", "2025-07-02T09:00:00Z"), M("b", "u2", "2025-07-01T09:00:00Z"), M("c", "u1", "2025-07-01T10:00:00Z")];
  it("メンバー重複除去・最新メッセージ", () => {
    expect(createRoom({ id: "r", name: "g", kind: "group", memberIds: ["u1", "u1"] }).memberIds.length).toBe(1);
    expect(lastMessage(msgs)?.id).toBe("a");
  });
  it("未読数(自分以外・既読後)と既読", () => {
    expect(unreadCount(msgs, { userId: "u2" })).toBe(2);
    expect(unreadCount(msgs, { userId: "u1" })).toBe(1);
    expect(unreadCount(msgs, markRead({ userId: "u2" }, "2025-07-03T00:00:00Z"))).toBe(0);
    expect(firstUnread(msgs, { userId: "u2" })?.id).toBe("c");
  });
  it("最新活動順にルームを並べる", () => {
    const rooms = [createRoom({ id: "r1", name: "A", kind: "group", memberIds: [], createdAt: "2025-01-01T00:00:00Z" }), createRoom({ id: "r2", name: "B", kind: "group", memberIds: [], createdAt: "2025-01-02T00:00:00Z" })];
    expect(sortRoomsByActivity(rooms, { r1: msgs, r2: [] })[0]?.id).toBe("r1");
  });
});
