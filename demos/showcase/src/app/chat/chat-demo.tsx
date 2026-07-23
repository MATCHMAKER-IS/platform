"use client";
/** チャットのデモ: ルーム・未読数・メンション・リアクション・ピン留め・返信。 */
import * as React from "react";
import { Button, Input } from "@platform/ui";
import {
  createMessage,
  sortMessages,
  groupByDate,
  extractMentions,
  canModifyMessage,
  unreadMentionsOf,
  unreadCount,
  markRead,
  firstUnread,
  sortRoomsByActivity,
  togglePin,
  isPinned,
  toggleReaction,
  countReactions,
  userReactions,
  MAX_MESSAGE_LENGTH,
  type ChatMessage,
  type ChatRoom,
  type RoomMember,
  type MessageReaction,
  type Pin,
} from "@platform/chat";

/** 自分。@handle はこれで判定する。 */
const ME = { id: "u-taro", handle: "taro", name: "山田太郎" };

const PEOPLE: Record<string, string> = {
  "u-taro": "山田太郎",
  "u-hanako": "鈴木花子",
  "u-admin": "管理者",
};

const ROOMS: ChatRoom[] = [
  { id: "r-jyoshi", name: "情シス", kind: "group", memberIds: ["u-taro", "u-hanako", "u-admin"], createdAt: "2026-07-01T00:00:00Z" },
  { id: "r-kaihatsu", name: "基盤開発", kind: "group", memberIds: ["u-taro", "u-hanako"], createdAt: "2026-07-01T00:00:00Z" },
  { id: "r-dm", name: "鈴木花子", kind: "dm", memberIds: ["u-taro", "u-hanako"], createdAt: "2026-07-01T00:00:00Z" },
];

const SEED: ChatMessage[] = [
  { id: "m1", roomId: "r-jyoshi", senderId: "u-hanako", text: "Amplify のデプロイ通りました！", at: "2026-07-16T09:12:00Z" },
  { id: "m2", roomId: "r-jyoshi", senderId: "u-taro", text: "おつかれさまです。ビルドログ見ておきます", at: "2026-07-16T09:15:00Z" },
  { id: "m3", roomId: "r-jyoshi", senderId: "u-admin", text: "@taro 来週の予算会議、基盤の進捗をまとめてもらえますか", at: "2026-07-17T08:30:00Z" },
  { id: "m4", roomId: "r-kaihatsu", senderId: "u-hanako", text: "型エラー、1ed2b55 で直したやつが消えてました", at: "2026-07-17T10:02:00Z" },
  { id: "m5", roomId: "r-kaihatsu", senderId: "u-taro", text: "git checkout で戻します", at: "2026-07-17T10:05:00Z", replyTo: "m4" },
  { id: "m6", roomId: "r-dm", senderId: "u-hanako", text: "@taro 明日の 1on1、15時で大丈夫ですか？", at: "2026-07-17T11:00:00Z" },
];

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const REACTIONS = ["like", "check", "eyes"];
const REACTION_EMOJI: Record<string, string> = { like: "👍", check: "✅", eyes: "👀" };

const time = (iso: string) => iso.slice(11, 16);

export function ChatDemo() {
  const [messages, setMessages] = React.useState<ChatMessage[]>(SEED);
  const [roomId, setRoomId] = React.useState("r-jyoshi");
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<ChatMessage | null>(null);
  const [pins, setPins] = React.useState<Pin[]>([]);
  const [reactions, setReactions] = React.useState<MessageReaction[]>([]);
  // ルームごとの既読位置。既定は「昨日まで読んだ」= 今日の分が未読。
  const [members, setMembers] = React.useState<Record<string, RoomMember>>({
    "r-jyoshi": { userId: ME.id, lastReadAt: "2026-07-16T23:59:59Z" },
    "r-kaihatsu": { userId: ME.id, lastReadAt: "2026-07-16T23:59:59Z" },
    "r-dm": { userId: ME.id, lastReadAt: "2026-07-16T23:59:59Z" },
  });

  const byRoom = React.useMemo(() => {
    const map: Record<string, ChatMessage[]> = {};
    for (const r of ROOMS) map[r.id] = messages.filter((m) => m.roomId === r.id);
    return map;
  }, [messages]);

  const orderedRooms = React.useMemo(() => sortRoomsByActivity(ROOMS, byRoom), [byRoom]);
  const current = byRoom[roomId] ?? [];
  const member = members[roomId] ?? { userId: ME.id };
  const groups = React.useMemo(() => groupByDate(sortMessages(current)), [current]);
  const unreadHere = unreadCount(current, member);
  const firstUnreadId = firstUnread(current, member)?.id;
  const myMentions = unreadMentionsOf(messages, ME.handle, member.lastReadAt);

  function send() {
    setError("");
    const r = createMessage({
      id: `m${Date.now()}`,
      roomId,
      senderId: ME.id,
      text,
      at: new Date().toISOString(),
      ...(replyTo ? { replyTo: replyTo.id } : {}),
    });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setMessages((prev) => [...prev, r.message]);
    setText("");
    setReplyTo(null);
  }

  function read() {
    setMembers((prev) => ({ ...prev, [roomId]: markRead(prev[roomId] ?? { userId: ME.id }) }));
  }

  function react(messageId: string, kind: string) {
    setReactions((prev) => toggleReaction(prev, { messageId, userId: ME.id, kind }));
  }

  function pin(messageId: string) {
    setPins((prev) => togglePin(prev, { roomId, messageId, pinnedBy: ME.id, pinnedAt: new Date().toISOString() }));
  }

  const draftMentions = extractMentions(text);

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>チャット</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <code>@platform/chat</code> は<strong>純ロジック</strong>です。未読数・メンション抽出・
        リアクションのトグル・ピン留めを持ちますが、<strong>通信も保存もしません</strong>。
        だから DB 無しのこの画面でそのまま動きます。実際の配信は <code>@platform/realtime</code>
        （<a href="/ws" style={{ color: "var(--color-primary)" }}>WebSocket のデモ</a>）と組み合わせます。
      </p>

      {myMentions.length > 0 && (
        <div style={{ ...box, borderColor: "var(--color-warning)", padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-warning)" }}>
            未読のメンションが {myMentions.length} 件あります
          </div>
          {myMentions.map((m) => (
            <div key={m.id} style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 4 }}>
              {ROOMS.find((r) => r.id === m.roomId)?.name} / {PEOPLE[m.senderId]}: {m.text}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, alignItems: "start" }}>
        {/* ルーム一覧 */}
        <div style={{ ...box, padding: 8 }}>
          <div style={{ fontSize: 11, color: "var(--color-muted)", padding: "4px 8px" }}>ルーム（最終発言順）</div>
          {orderedRooms.map((r) => {
            const un = unreadCount(byRoom[r.id] ?? [], members[r.id] ?? { userId: ME.id });
            return (
              <Button
                key={r.id}
                onClick={() => setRoomId(r.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "var(--radius)",
                  border: "none",
                  background: roomId === r.id ? "var(--color-primary)" : "transparent",
                  color: roomId === r.id ? "var(--color-primary-fg)" : "var(--color-fg)",
                  cursor: "pointer",
                  fontSize: 13,
                  textAlign: "left",
                }}
              >
                <span>
                  {r.kind === "dm" ? "" : "# "}
                  {r.name}
                </span>
                {un > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      minWidth: 18,
                      textAlign: "center",
                      padding: "1px 5px",
                      borderRadius: 999,
                      background: "var(--color-danger)",
                      color: "#fff",
                    }}
                  >
                    {un}
                  </span>
                )}
              </Button>
            );
          })}
          <p style={{ fontSize: 10, color: "var(--color-muted)", padding: "8px 8px 4px", lineHeight: 1.6 }}>
            並び順は <code>sortRoomsByActivity()</code>。未読数は <code>unreadCount()</code> が
            <strong>既読時刻より後の他人の発言</strong>を数えます（自分の発言は数えません）。
          </p>
        </div>

        {/* メッセージ */}
        <div style={{ ...box, padding: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--color-border)" }}>
            <b style={{ fontSize: 14 }}>
              {ROOMS.find((r) => r.id === roomId)?.kind === "dm" ? "" : "# "}
              {ROOMS.find((r) => r.id === roomId)?.name}
            </b>
            <Button
              onClick={read}
              disabled={unreadHere === 0}
              style={{
                height: 28,
                padding: "0 12px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--color-border)",
                background: "var(--color-bg)",
                color: unreadHere === 0 ? "var(--color-muted)" : "var(--color-fg)",
                cursor: unreadHere === 0 ? "default" : "pointer",
                fontSize: 12,
              }}
            >
              {unreadHere === 0 ? "既読" : `${unreadHere} 件を既読にする`}
            </Button>
          </div>

          <div style={{ maxHeight: 420, overflowY: "auto", padding: 14 }}>
            {groups.map((g) => (
              <div key={g.date}>
                <div style={{ textAlign: "center", fontSize: 11, color: "var(--color-muted)", margin: "10px 0" }}>{g.date}</div>
                {g.messages.map((m) => {
                  const mine = m.senderId === ME.id;
                  const counts = countReactions(reactions, m.id);
                  const mineReactions = userReactions(reactions, m.id, ME.id);
                  const parent = m.replyTo !== undefined ? messages.find((x) => x.id === m.replyTo) : undefined;
                  return (
                    <div key={m.id}>
                      {m.id === firstUnreadId && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0" }}>
                          <div style={{ flex: 1, height: 1, background: "var(--color-danger)" }} />
                          <span style={{ fontSize: 10, color: "var(--color-danger)", fontWeight: 700 }}>ここから未読</span>
                          <div style={{ flex: 1, height: 1, background: "var(--color-danger)" }} />
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 2 }}>
                          {PEOPLE[m.senderId]} {time(m.at)}
                          {isPinned(pins, roomId, m.id) && <span style={{ marginLeft: 6 }}>📌</span>}
                        </div>
                        {parent && (
                          <div style={{ fontSize: 10, color: "var(--color-muted)", borderLeft: "2px solid var(--color-border)", paddingLeft: 6, marginBottom: 3, maxWidth: 320 }}>
                            {PEOPLE[parent.senderId]}: {parent.text.slice(0, 30)}
                          </div>
                        )}
                        <div
                          style={{
                            maxWidth: 380,
                            padding: "8px 12px",
                            borderRadius: 12,
                            fontSize: 13,
                            lineHeight: 1.7,
                            background: mine ? "var(--color-primary)" : "var(--color-bg)",
                            color: mine ? "var(--color-primary-fg)" : "var(--color-fg)",
                            border: mine ? "none" : "1px solid var(--color-border)",
                          }}
                        >
                          {m.text}
                        </div>
                        <div style={{ display: "flex", gap: 4, marginTop: 4, alignItems: "center" }}>
                          {REACTIONS.map((k) => {
                            const n = counts[k] ?? 0;
                            const on = mineReactions.includes(k);
                            return (
                              <Button
                                key={k}
                                onClick={() => react(m.id, k)}
                                style={{
                                  fontSize: 11,
                                  padding: "1px 6px",
                                  borderRadius: 999,
                                  border: "1px solid",
                                  borderColor: on ? "var(--color-primary)" : "var(--color-border)",
                                  background: "var(--color-bg)",
                                  color: "var(--color-fg)",
                                  cursor: "pointer",
                                }}
                              >
                                {REACTION_EMOJI[k]}
                                {n > 0 && <span style={{ marginLeft: 3 }}>{n}</span>}
                              </Button>
                            );
                          })}
                          <Button onClick={() => setReplyTo(m)} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, border: "none", background: "transparent", color: "var(--color-muted)", cursor: "pointer" }}>
                            返信
                          </Button>
                          <Button onClick={() => pin(m.id)} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, border: "none", background: "transparent", color: "var(--color-muted)", cursor: "pointer" }}>
                            {isPinned(pins, roomId, m.id) ? "固定解除" : "固定"}
                          </Button>
                          {canModifyMessage(m, ME.id) && (
                            <span style={{ fontSize: 10, color: "var(--color-muted)" }}>編集可</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid var(--color-border)", padding: 12 }}>
            {replyTo && (
              <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                <span>返信先: {PEOPLE[replyTo.senderId]} 「{replyTo.text.slice(0, 24)}」</span>
                <Button aria-label="返信をやめる" title="返信をやめる" onClick={() => setReplyTo(null)} style={{ border: "none", background: "transparent", color: "var(--color-muted)", cursor: "pointer" }}>×</Button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) send();
                }}
                placeholder="メッセージ（@taro でメンション）"
                style={{ flex: 1, height: 36, padding: "0 12px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", fontSize: 13 }}
              />
              <Button onClick={send} style={{ height: 36, padding: "0 18px", borderRadius: "var(--radius)", border: "none", background: "var(--color-primary)", color: "var(--color-primary-fg)", cursor: "pointer", fontSize: 13 }}>
                送信
              </Button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11 }}>
              <span style={{ color: error !== "" ? "var(--color-danger)" : "var(--color-muted)" }}>
                {error !== "" ? error : draftMentions.length > 0 ? `メンション: ${draftMentions.map((h) => `@${h}`).join(" ")}` : ""}
              </span>
              <span style={{ color: text.length > MAX_MESSAGE_LENGTH ? "var(--color-danger)" : "var(--color-muted)" }}>
                {text.length} / {MAX_MESSAGE_LENGTH}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...box, marginTop: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>試してみてください</h2>
        <ul style={{ fontSize: 13, lineHeight: 2, margin: 0, paddingLeft: "1.2em", color: "var(--color-muted)" }}>
          <li>
            <strong>空のまま送信</strong> → <code>createMessage()</code> が「メッセージが空です」で弾きます。
            <strong>UI ではなくロジック側が拒否している</strong>ので、API 経由でも同じ結果になります
          </li>
          <li>
            <strong>「ここから未読」の線</strong> — <code>firstUnread()</code> が既読時刻から求めています
          </li>
          <li>
            <strong>自分の発言は未読に数えません</strong> — 自分で送って未読が増えないことを確認できます
          </li>
          <li>
            <strong><code>@taro</code> と書いて送信</strong> → 上部に未読メンションとして出ます。
            <code>extractMentions()</code> は入力中も動いています（下に表示）
          </li>
          <li>リアクションは<strong>同じものを 2 回押すと取り消し</strong>（<code>toggleReaction()</code>）</li>
        </ul>
      </div>
    </>
  );
}
