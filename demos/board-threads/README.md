# @demos/board-threads — 掲示板（board × ui）

`@platform/board`（スレッド・投稿・リアクション集計）を `@platform/ui` の `PostCard` / スレッド一覧に流す例。
- `toPostView(post, reactions, meId, nameOf)` — 自分のリアクション状態つきで `PostCard` 用に整形。
- `toThreadList(threads, postsByThread)` — `summarize` で要約し `sortThreads`（ピン→最新順）で並べる。

投稿の作成・返信・リアクションは `createPost` / `toggleReaction` を呼ぶだけ。
