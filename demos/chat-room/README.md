# @demos/chat-room — チャットのライブ配信（chat × realtime）

`@platform/chat`（メッセージ検証・整列）と `@platform/realtime`（BroadcastHub 同報）を結線した例。
- `sendMessage(hub, input)` — `createMessage` で検証 → OK なら `hub.publish` でルームチャネルへ同報。
- `joinRoom(hub, roomId, connId, onMessage)` — ルームを購読し、受信を `onMessage` に渡す（返り値で解除）。
- `toMessageGroups(messages, meId, nameOf)` — UI の `ChatWindow` / `MessageList` が使う `MessageGroup[]` へ整形。

画面は `@platform/ui` の `ChatWindow`（`onSend` → `sendMessage`）に流すだけ。複数インスタンスでも Redis Pub/Sub 経由で全接続へ届く。
