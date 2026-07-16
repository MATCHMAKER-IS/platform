/**
 * チャットのライブ配信を @platform/chat(メッセージ検証)× @platform/realtime(同報)で結線する例。
 * 送信時に createMessage で検証してから hub.publish、購読側は onMessage で受け取る。
 * @packageDocumentation
 */
import { createMessage, type ChatMessage } from "@platform/chat";
import { type BroadcastHub } from "@platform/realtime";

/** ルームのチャネル名。 */
export function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

/** 送信結果。 */
export type SendResult = { ok: true; message: ChatMessage } | { ok: false; error: string };

/**
 * メッセージを検証して配信する。検証 NG なら publish せずエラーを返す。
 */
export async function sendMessage(hub: BroadcastHub, input: { id: string; roomId: string; senderId: string; text: string; at?: string }): Promise<SendResult> {
  const created = createMessage(input);
  if (!created.ok) return created;
  await hub.publish(roomChannel(input.roomId), created.message);
  return { ok: true, message: created.message };
}

/**
 * ルームを購読し、受信メッセージを onMessage に渡す。返り値で購読解除。
 */
export async function joinRoom(
  hub: BroadcastHub,
  roomId: string,
  connectionId: string,
  onMessage: (message: ChatMessage) => void,
): Promise<() => Promise<void>> {
  const channel = roomChannel(roomId);
  await hub.subscribe(channel, connectionId, (data: string) => {
    onMessage(JSON.parse(data) as ChatMessage);
  });
  return () => hub.unsubscribe(channel, connectionId);
}
