# @platform/social

SNS のハンドル（正規化・URL 生成）。

## これは何のためか

**利用者は URL を貼ります。**

「@yamada」と入れてほしくても、
**`https://x.com/yamada` を貼る**人がいます——**両方受けます**。

## 使う前に知っておくこと

| | |
|---|---|
| **URL からハンドルを取り出します** | 貼られても**そのまま受けられます** |
| **妥当でなければ `null`** | 推測しません——**間違ったアカウントへリンクする**方が危ないためです |
| **サービスごとに規則が違います** | 使える文字も長さも違います——**共通の検証はできません** |
| **なりすましを検証できません** | 「そのハンドルが本人か」は**分かりません**——**本人確認には使わないで**ください |

## よく使うもの

```ts
import { normalizeHandle, buildProfileUrl } from "@platform/social";
import { parseSocialUrl, accountsFromUrls } from "@platform/social";

parseSocialUrl("https://www.tiktok.com/@cast01/video/71");
// { platform: "tiktok", type: "post", handle: "cast01", postId: "71", postKind: "video" }

// キャストが貼った複数リンク → アカウント一覧(妥当なもののみ・重複排除)
const accounts = accountsFromUrls([
  "https://x.com/yamada_taro",
  "https://www.tiktok.com/@yamada.dance",
  "https://www.instagram.com/yamada_ig/",
]);
```

## ハンドルの正規化・検証・プロフィール URL
```ts
import { normalizeHandle, isValidHandle, buildProfileUrl, displayHandle } from "@platform/social";
normalizeHandle("@yamada_taro");                 // "yamada_taro"
isValidHandle("x", "yamada_taro");                // true(X は 15字・英数と _)
buildProfileUrl("tiktok", "cast01");              // "https://www.tiktok.com/@cast01"
displayHandle("tiktok", "cast01");                // "@cast01"(TikTok は @ 付き)
```

## 表示用リンク・プラットフォーム別
```ts
import { accountLinks, accountsByPlatform } from "@platform/social";
accountLinks(accounts);       // [{ platform, label: "@handle", url }] を x→tiktok→ig 順で
accountsByPlatform(accounts); // { x, tiktok, instagram } 形(プロフィール編集フォーム用)
```

## 投稿の埋め込み(oEmbed)
```ts
import { oembedEndpoint, supportsOEmbed } from "@platform/social";
oembedEndpoint("x", tweetUrl, { theme: "dark", omitScript: true });   // 取得用URL(fetchはアプリ側)
oembedEndpoint("tiktok", videoUrl);
supportsOEmbed("instagram");   // false — Instagram は Graph API のトークンが必要
```

## 補足
- ハンドル規則は各社の一般的な仕様に準拠(X: 15字/英数_、TikTok: 2〜24字/英数_.、Instagram: 30字/英数_.)。
- 投稿の取得・埋め込みには各社の埋め込みスクリプトや API 認証が必要です。この基盤は URL とアカウントの
  取り回し(解析・生成・検証・重複排除)を担い、ネットワークアクセスは行いません。

## 統合フィード(定期取得)
各プラットフォームから取得した投稿を 1 つのタイムラインにまとめます。取得は `@platform/integrations`、
定期実行は `@platform/jobs`。この基盤は取得結果の正規化・統合・差分抽出を担います。
```ts
import { mergeSocialFeed, latestPerPlatform, newPosts, recentPosts } from "@platform/social";

const timeline = mergeSocialFeed(allPosts);        // 新しい順・重複排除
latestPerPlatform(allPosts);                        // 各SNSの最新1件(キャストページのSNS欄)
const fresh = newPosts(allPosts, knownKeys);        // 前回以降の新着だけ(通知用)
recentPosts(allPosts, 10);                          // 直近10件
```
`SocialPost { platform, id, url, text?, thumbnail?, createdAt, kind?, likeCount? }` に正規化して渡します。

