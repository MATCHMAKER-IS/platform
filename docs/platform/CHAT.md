# チャット / 掲示板 — 配信・通知・添付の結線

`@platform/chat`・`@platform/board`（純ロジック）を、`@platform/realtime`（配信）・`@platform/notify`（通知）・
`@platform/upload`＋`@platform/storage`（添付保存）と結線した、実運用の構成一式。

## レイヤ
- **ロジック**: `@platform/chat`（メッセージ・ルーム・未読・メンション・添付検証）、`@platform/board`（スレッド・投稿・リアクション・添付検証）。
- **配線（アプリ）**: `apps/internal-app/src/server/`
  - `chat-gateway.ts` — `createChatGateway({ hub, newId, onMentions?, attachmentLimits? })`。購読/解除/送信をトランスポート非依存で提供（WebSocket でも SSE でも `send(data)` を渡すだけ）。送信時に `createMessage` で検証 → `hub.publish` で全接続へ同報 → メンションがあれば `onMentions` を発火。
  - `chat-notify.ts` — `buildMentionNotifier({ notifierFor, template?, senderName?, roomName? })`。メンション名 → その人の `Notifier`（Slack/メール等）へ「メンションされました」を送る。送信者自身は除外。
  - `chat.ts` — 具体配線。既定はシングルインスタンス（プロセス内 Pub/Sub・メモリ storage）。**水平スケール時は Pub/Sub を Redis（ioredis 等）に、保存を `createLocalStorage(root)` / `createS3Storage(...)` に差し替えるだけ**で gateway・route は無変更。

## HTTP エンドポイント（Next.js App Router）
- `POST /api/chat/rooms/[roomId]/messages` — 認可（`chat:post`）→ 送信。ボディ `{ text?, replyTo?, attachments? }`。検証 NG は 400、成功は 201 でメッセージを返す。
- `GET /api/chat/rooms/[roomId]/stream` — 認可（`chat:read`）→ **Server-Sent Events** でルームを購読。`data: {json}\n\n` を送り続け、切断で購読解除。長時間接続のため観測ラッパは付けない。
- `POST /api/chat/rooms/[roomId]/attachments` — 認可（`chat:post`）→ `multipart/form-data` を検証（画像/PDF・10MB・5件まで）して storage に保存。`{ attachments: [{ key, name, size, type }] }` を返す。これを messages API の `attachments` に渡す。

### クライアント側
- 受信は `EventSource("/api/chat/rooms/{id}/stream")`、または `@platform/realtime` の `createReconnectingWebSocket`（WS サーバを別立てする場合）。
- 送信前に添付があれば attachments API にアップロードし、返ってきたメタを messages API に付ける。

## 権限
`APP_POLICY` の `employee` に `chat:read` / `chat:post` / `board:read` / `board:post` を付与済み（全ログインユーザーが利用可）。

## メンション通知の運用
`server/chat.ts` の `mentionDirectory`（handle → メールアドレス）に登録された相手にだけ通知が飛ぶ（未登録は送られない）。実運用ではユーザーストアから解決するよう差し替える。

## UI
`@platform/ui`: `ChatWindow` / `MessageList` / `MessageComposer` / `MessageBubble`（チャット）、`PostCard`（掲示板）、`AttachmentList`（画像サムネ＋ファイルチップ）。

---

## 画面（Next.js App Router）
- `app/chat/[roomId]/page.tsx` → `chat-room-client.tsx` — `createChatController` で SSE 購読し、`@platform/ui` の `ChatWindow` に流す。送信は `controller.send`、新着で自動的に既読送信。
- `app/chat/rooms-client.tsx` — `/api/chat/rooms` から未読数を取得し、`Badge` で未読バッジ表示。
- `app/board/[threadId]/page.tsx` → `board-thread-client.tsx` — 投稿を board 投稿 API に送り、`PostCard` で一覧表示。

### クライアント制御（`app/chat/chat-controller.ts`）
`createChatController({ roomId, onChange, EventSourceImpl?, fetchImpl? })` — フレームワーク非依存。SSE 受信を整列・重複排除して保持し、`send` / `markRead` は fetch で API を叩く。EventSource / fetch を注入できるためテスト可能（React はこの購読を薄くラップするだけ）。

## 既読同期
- `server/chat-store.ts` — `createMemoryChatStore()`。送信メッセージをルームごとに直近 N 件保持し、既読位置（lastReadAt）を保存。未読数は `@platform/chat` の `unreadCount`（自分以外・最終既読より後）に委譲。**本番は Prisma のメッセージ/既読テーブルに差し替え**（route は無変更）。
- `POST /api/chat/rooms/[roomId]/read` — 既読位置を保存（後退しない）。
- `GET /api/chat/rooms?rooms=r1,r2` — 指定ルームの未読数と直近時刻を返す（新しい順）。
- gateway の `onSent` フックで配信後に履歴へ記録する（未読数算出のため）。

## 掲示板のメンション通知
- `buildMentionNotifier` は `MentionContext { senderId, text, contextId? }` を取る汎用形になり、**chat と board で同じ通知器を再利用**する。テンプレートは `{{sender}} {{context}} {{text}}`。
- `server/board.ts` — `createBoardService({ newId, onMentions, attachmentLimits })`。`createPost` で検証し、本文のメンションを通知器へ流す（`contextId` にスレッド ID）。
- `POST /api/board/threads/[threadId]/posts` — 認可（`board:post`）→ 検証 → メンション通知。

---

## 永続化（Prisma）
`schema.prisma` に `ChatRoomRow` / `RoomMemberRow` / `ChatMessageRow` / `MessageReadRow` を追加。
- `server/chat-store.ts` — `ChatStore` は非同期インターフェース。`createMemoryChatStore`（開発）と `createPrismaChatStore`（本番）が同じ契約を満たす。未読ロジックは `toRoomUnread`（`@platform/chat` の `unreadCount`）に集約し、両実装で共通。
- `server/chat-store-prisma.ts` — `createPrismaChatStore(db, { keepPerRoom })`。`ChatStoreDb` は使用する Prisma デリゲート（`chatMessageRow` / `messageReadRow`）の最小ポートで、フェイクに差し替えてロジックを検証できる（memory 実装と未読数が一致することをスモークで確認）。
- 切り替え: `CHAT_PERSISTENCE=prisma` かつ `prisma generate` 済みで `createPrismaChatStore(db)` が有効になる（gateway・route は無変更）。
- gateway の `onSent` フックで配信後に `chatStore.append` する。

## ルーム管理
- `server/chat-rooms.ts` — `RoomRepository`（`createMemoryRoomRepo`／Prisma 差し替え可）。`create`（owner 登録・初期メンバー重複除去）／`addMember`／`removeMember`／`roomsForUser`／`isMember`。
- `POST /api/chat/rooms` — ルーム作成（作成者を owner に）。
- `GET /api/chat/rooms` — **所属ルームを未読数つきで返す**（`?rooms=` 指定は不要になり、メンバーシップから解決）。
- `POST /api/chat/rooms/[roomId]/members` — メンバー招待（そのルームのメンバーのみ可）。

## プレゼンス（オンライン・タイピング）
- `server/chat-presence.ts` — `createPresenceTracker({ onlineTtlMs, typingTtlMs })`。ハートビート／タイピングを TTL 付きで保持し、スナップショット時に期限切れを間引く（時刻は ms で受けるためテスト可能）。
- gateway に `publishTyping(roomId, userId)` を追加（`{ typing: true }` の封筒をルームチャネルへ同報）。SSE ストリームはこの封筒も流し、クライアント制御が `onTyping` として振り分ける（メッセージと区別）。
- `POST /api/chat/rooms/[roomId]/typing` — プレゼンスに記録＋他接続へ同報（204）。
- `GET /api/chat/rooms/[roomId]/presence` — オンライン／入力中の一覧。
- ストリーム接続時に `presence.heartbeat`、切断時に `presence.offline`。
- クライアント制御 `chat-controller.ts` に `sendTyping()` / `onTyping` を追加。React 画面（`chat-room-client.tsx`）は「〇〇 が入力中…」を表示。

---

## 全文検索（@platform/search）
- `server/chat-search.ts` — `createChatSearch({ messageSearch, postSearch })`。メッセージと投稿を**別々の BM25 索引**に入れ、`roomId`/`threadId` で絞り込む。トークン化は日本語（CJK バイグラム）対応で、部分語でもヒットする。
- 配線（`chat.ts`）: `createSearch(createMemorySearch({ fieldBoosts }))` を 2 本。本番は `createMeilisearchAdapter` に差し替え可能。
- gateway の `onSent`/`onEdited`/`onDeleted` と boardService の `onPosted` フックで、送信・編集・削除・投稿に追随して索引を更新。
- `GET /api/chat/search?q=&roomId=&limit=` / `GET /api/board/search?q=&threadId=&limit=`。

## メッセージ・投稿の編集/削除
- パッケージ: `@platform/chat` に `editMessage` / `canModifyMessage`、`@platform/board` に `editPost` / `canModifyPost`（本人 or 管理者のみ）。
- `ChatStore` に `update` / `remove` を追加（memory / Prisma 両実装）。編集/削除対象は `lookupMessage`（直近履歴から）で引く。
- gateway に `edit` / `remove`。権限を確認し、編集は `{ edit: true, message }`、削除は `{ delete: true, id }` の封筒を全接続へ同報。クライアント制御はこれを受けて一覧を差し替え／除去する。
- `PATCH` / `DELETE /api/chat/rooms/[roomId]/messages/[messageId]`（本人/管理者、他人は 403）。
- `PATCH` / `DELETE /api/board/threads/[threadId]/posts/[postId]`（投稿リポジトリ未実装のため対象をボディで受け、認証ユーザーで権限判定。実運用ではリポジトリから取得する）。
- クライアント制御 `chat-controller.ts` に `editMessage` / `deleteMessage`、React 側の受信処理も対応。

## 通知の集約・ダイジェスト
- `server/chat-digest.ts` — `buildUnreadDigest({ store, roomRepo, notifierFor, roomName })`。ユーザーごとに所属ルームの未読を集計し、**未読があるときだけ 1 通の要約**（多い順）を送る。未読なし・通知口なしはスキップ。
- 定期実行: `chat.ts` の `unreadDigestJob` は `@platform/cron` の `createGuardedJob`（`preventOverlap` + ジッタ）。`setDigestUsers(() => [...])` で対象ユーザーを供給し、scheduler から `unreadDigestJob.run()` を定期起動（例: 毎朝）。多重実行防止・失敗ハンドリング込み。

---

## 検索 UI（ハイライト）
- `@platform/ui`: `highlightSegments(text, query)`（純関数・大小無視・CJK 前方一致・連続まとめ）と `HighlightedText`（`<mark>` 強調）。
- `app/chat/search-client.tsx` — 検索ボックス（`SearchInput`・250ms デバウンス）＋結果一覧。`/api/chat/search`・`/api/board/search` を叩き、一致箇所を `HighlightedText` で強調。

## メッセージのリアクション
- `@platform/chat`: `reaction.ts`（`MessageReaction { messageId, userId, kind }` / `toggleReaction`（再押しで解除）/ `countReactions` / `userReactions`）。
- `server/chat-reactions.ts` — `ReactionStore`（`createMemoryReactionStore`・Prisma 差し替え可）。
- gateway に `react({ roomId, messageId, userId, kind })`。トグルして最新カウントを `{ reaction: true, messageId, counts }` 封筒で全接続へ同報。クライアント制御は `onReaction(messageId, counts)` で受け取る。
- `POST /api/chat/rooms/[roomId]/messages/[messageId]/reactions`（ボディ `{ kind }`）。
- クライアント制御 `chat-controller.ts` に `react(messageId, kind)`、React 側にリアクション state。

## 添付のサムネイル生成
- `server/chat-thumbnails.ts` — `createThumbnailService({ processor, storage, maxSize })`。画像添付を `@platform/image` で縮小し（`fitDimensions` で縦横比維持・`withoutEnlargement`）、`@platform/storage` に保存して `thumbnailKey` を付与。画像でない添付・取得失敗はそのまま返す（壊さない）。処理系（sharp）は注入可能。
- 配線（`chat.ts`）: `createImageProcessor()`（本番 sharp）＋ `chatStorage`。添付アップロード API（`attachments/route.ts`）で `ensureAll` を通し、画像に `thumbnailKey` を付ける。
- `@platform/ui` の `AttachmentList` は `thumbnailUrl`（thumbnailKey から解決）を優先してグリッド表示し、開くと原寸。`loading="lazy"`。

---

## ピン留め・ブックマーク
- `@platform/chat`: `pin.ts`（`Pin`/`Bookmark` 型、`togglePin`/`isPinned`/`pinsOf`、`toggleBookmark`/`isBookmarked`/`bookmarksOf`。いずれもトグル・新しい順整列の純ロジック）。
- `server/chat-pins.ts` — `PinStore`（`createMemoryPinStore`・Prisma 差し替え可）。ピンはルーム共有、ブックマークは個人。
- gateway に `pin({ roomId, messageId, userId })`。トグルして `{ pin: true, messageId, pinned }` 封筒を全接続へ同報。クライアント制御は `onPin(messageId, pinned)` で受け取る。
- `POST`/`DELETE /api/chat/rooms/[roomId]/messages/[messageId]/pin`（トグル）、`GET /api/chat/rooms/[roomId]/pins`。
- `POST /api/chat/rooms/[roomId]/messages/[messageId]/bookmark`（個人トグル）、`GET /api/chat/bookmarks`。

## メンションの未読集計
- `@platform/chat`: `unreadMentionsOf(messages, handle, lastReadAt?)`（@handle 宛かつ最終既読より後）。
- `server/chat-mentions.ts` — `MentionInbox`（`createMentionInbox({ store, roomRepo })`）。所属ルームを横断し、未読メンションの件数と一覧（新しい順・limit）を返す。
- `GET /api/chat/mentions?handle=`（省略時はメールのローカル部）→ `{ count, mentions }`。

## リアクションの永続化
- `schema.prisma` に `MessageReactionRow`（unique `messageId+userId+kind`）、`PinRow`、`BookmarkRow` を追加。
- `server/chat-reactions.ts` に `createPrismaReactionStore(db)`。トグルは find→delete/create、集計は `countReactions` に委譲。`CHAT_PERSISTENCE=prisma` で有効化。フェイク db でロジックを検証し、memory 実装と**完全一致**することをスモークで確認。

---

## ピン留め・メンションの UI / ピンの永続化
### UI
- `@platform/ui`: `PinnedBanner`（ピン留めバナー・折りたたみ可・ジャンプ/解除ボタン。`PinnedItem { messageId, text, pinnedByName? }`）。
- `app/chat/[roomId]/chat-room-client.tsx` — ルームのピン一覧を取得して `PinnedBanner` を表示。ピン変化（`onPin`）で再取得、解除は `DELETE .../pin`。
- `app/chat/bookmarks-client.tsx` — 個人ブックマーク一覧（`/api/chat/bookmarks`）。
- `app/chat/mention-inbox-client.tsx` — ベル＋未読バッジ＋ドロップダウン一覧（`/api/chat/mentions`・ポーリング）。

### ピン/ブックマークの永続化
- `server/chat-pins.ts` に `createPrismaPinStore(db)`（`PinRow` / `BookmarkRow` を使用）。トグルは find→delete/create、一覧は `pinnedAt`/`at` の降順。`CHAT_PERSISTENCE=prisma` で有効化。
- フェイク db でロジックを検証し、memory 実装と togglePin/pins/toggleBookmark/bookmarks が**完全一致**することをスモークで確認（ISO 往復・unique 制約含む）。
