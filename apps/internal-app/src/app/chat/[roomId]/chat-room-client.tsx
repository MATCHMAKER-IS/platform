"use client";
/**
 * チャットルームのクライアント画面。createChatController で SSE 購読し、@platform/ui の ChatWindow に流す。
 * 送信は controller.send、表示中は既読を送る。
 * @packageDocumentation
 */
import * as React from "react";
import { ChatWindow, PinnedBanner, type PinnedItem } from "@platform/ui";
import { groupByDate, type ChatMessage } from "@platform/chat";
import { createChatController, type ChatController } from "../chat-controller.js";

/** 時刻 "HH:MM"。 */
function hhmm(iso: string): string {
  return iso.slice(11, 16);
}

/** props。 */
export interface ChatRoomClientProps {
  roomId: string;
  roomName: string;
  /** 現在ユーザー(own 判定に使う)。 */
  meId: string;
  /** ユーザー ID → 表示名。 */
  displayName?: (id: string) => string;
}

/** チャットルーム画面。 */
export function ChatRoomClient({ roomId, roomName, meId, displayName }: ChatRoomClientProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = React.useState<string[]>([]);
  const [reactionCounts, setReactionCounts] = React.useState<Record<string, Record<string, number>>>({});
  const [pinnedItems, setPinnedItems] = React.useState<PinnedItem[]>([]);
  const controllerRef = React.useRef<ChatController | null>(null);
  const typingTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  React.useEffect(() => {
    const controller = createChatController({
      roomId,
      onChange: setMessages,
      onTyping: (userId) => {
        setTypingUsers((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
        clearTimeout(typingTimers.current[userId]);
        typingTimers.current[userId] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== userId));
        }, 4000);
      },
      onReaction: (messageId, counts) => {
        setReactionCounts((prev) => ({ ...prev, [messageId]: counts }));
      },
      onPin: () => {
        void loadPins();
      },
    });
    controllerRef.current = controller;
    controller.start();
    return () => controller.close();
  }, [roomId]);

  // 新着が来たら既読を更新
  React.useEffect(() => {
    if (messages.length > 0) void controllerRef.current?.markRead();
  }, [messages.length]);

  const nameOf = displayName ?? ((id: string) => id);
  const groups = groupByDate(messages).map((g) => ({
    date: g.date,
    messages: g.messages.map((m) => ({
      id: m.id,
      text: m.text,
      authorName: nameOf(m.senderId),
      timestamp: hhmm(m.at),
      own: m.senderId === meId,
      edited: Boolean(m.editedAt),
    })),
  }));

  const onSend = (text: string) => {
    void controllerRef.current?.send(text);
  };

  const onReact = (messageId: string, kind: string) => {
    void controllerRef.current?.react(messageId, kind);
  };

  const loadPins = React.useCallback(async () => {
    const res = await fetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/pins`);
    if (!res.ok) return;
    const data = (await res.json()) as { pins: { messageId: string; pinnedBy: string }[] };
    const byId = new Map(messages.map((m) => [m.id, m.text]));
    setPinnedItems(data.pins.map((p) => ({ messageId: p.messageId, text: byId.get(p.messageId) ?? "(メッセージ)", pinnedByName: p.pinnedBy })));
  }, [roomId, messages]);

  React.useEffect(() => {
    void loadPins();
  }, [loadPins]);

  const onUnpin = (messageId: string) => {
    void fetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}/pin`, { method: "DELETE" }).then(() => loadPins());
  };
  // reactionCounts / onReact は ChatWindow のリアクション表示に渡せる（UI 拡張時に使用）。
  void reactionCounts;
  void onReact;

  const othersTyping = typingUsers.filter((u) => u !== meId).map((u) => nameOf(u));
  const typingLine = othersTyping.length > 0 ? `${othersTyping.join("、")} が入力中…` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <PinnedBanner items={pinnedItems} onUnpin={onUnpin} />
      <ChatWindow title={roomName} subtitle={typingLine ?? `${messages.length} 件`} groups={groups} onSend={onSend} className="h-[70vh]" />
    </div>
  );
}
