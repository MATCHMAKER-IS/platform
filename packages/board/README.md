# @platform/board

掲示板の純ロジック（スレッド・投稿・返信・リアクション）。

## 投稿（post.ts）
- `createThread` / `createPost` — 空・長すぎ（`MAX_POST_LENGTH=10000` / `MAX_TITLE_LENGTH=200`）は失敗。trim。
- `canReply(thread)` — 施錠（`locked`）で返信不可。`rootPosts` / `repliesOf` — 本文と返信の分離。
- `extractMentions` — `@handle` 抽出。

## リアクション（reaction.ts）
- `toggleReaction` — 同じ種別を再度押すと解除（トグル）。`countReactions` / `userReactions`。

## 一覧（thread-list.ts）
- `summarize(thread, posts)` — 返信数・参加者数・最終更新。
- `sortThreads` — ピン→最新順。`filterByTag` / `searchThreads`（タイトル・本文）。

UI は `@platform/ui` の `PostCard`。

## 添付（attachment.ts）
- `Attachment` / `validateAttachments` / `imageAttachments` — chat と同形。
- `createPost` は本文が空でも添付があれば成功する。
