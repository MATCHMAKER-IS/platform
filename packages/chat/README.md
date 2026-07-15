# @platform/chat

チャットの純ロジック（メッセージ・ルーム・未読管理）。リアルタイム配信は `@platform/realtime` と組み合わせる。

## メッセージ（message.ts）
- `createMessage(input)` / `editMessage(message, text)` — 空・空白のみ・長すぎ（`MAX_MESSAGE_LENGTH=4000`）は失敗。trim。
- `sortMessages` — 時系列（古→新）。`groupByDate` — 日付ごとにグループ化（区切り表示用）。
- `extractMentions(text)` / `mentionsOf(messages, handle)` — `@handle` 抽出・宛先絞り込み。
- `repliesTo(messages, id)` — スレッド返信。

## ルーム（room.ts）
- `createRoom` — `kind: "dm" | "group"`、メンバー重複除去。
- `unreadCount(messages, member)` — 自分以外・最終既読より後を数える。`markRead` / `firstUnread`。
- `lastMessage` / `sortRoomsByActivity` — ルーム一覧を最新活動順に。

すべて外部依存なし・純関数。UI は `@platform/ui` の `ChatWindow` / `MessageList` / `MessageComposer`。

## 添付（attachment.ts）
- `Attachment { key, name, size, type }` — `@platform/upload` の UploadedFile と整合。
- `validateAttachments(files, { maxCount, maxSizeBytes, allowedTypes })` — 件数・サイズ・MIME（前方一致）を検証。
- `imageAttachments` / `totalSize`。
- `createMessage` は本文が空でも添付が 1 件以上あれば成功する。
