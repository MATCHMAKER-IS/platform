# @platform/push

Web Push 通知（ブラウザを閉じていても届く）。

## これは何のためか

**画面を開いていなくても知らせる**ためのものです。

承認依頼や障害の連絡は、**開いていないと気づけません**。

## 使う前に知っておくこと

| | |
|---|---|
| **許可を求めるのは一度だけ** | 断られると、**次から出せません**——**なぜ要るかを説明してから**求めてください |
| **送るたびに新しい鍵** | 暗号化の仕組みです——**使い回さないで**ください |
| **ドメインごとに購読が別** | 開発と本番で**別のものになります** |
| **届かないことがあります** | 端末が電源を切っていれば届きません——**確実な連絡には使わないで**ください |
| **iOS は条件が厳しい** | ホーム画面に追加していないと**動きません** |

## よく使うもの

```ts
import { generateVapidKeys, buildVapidHeader, encryptPayload } from "@platform/push";
import { generateVapidKeys, sendPush, broadcastPush } from "@platform/push";

// 一度だけ作る(変えると既存の購読がすべて無効になる)
const vapid = generateVapidKeys("mailto:ops@example.co.jp");

const r = await sendPush(sub, { title: "承認待ち", body: "経費 3 件", url: "/approvals" }, { vapid });
if (r.gone) await store.remove(sub.endpoint);   // **消さないと溜まる**
```

## なぜ要るか

業務の通知はメールと Slack で足りることが多いですが、**すぐ気づいてほしいもの**には弱いです
——メールは埋もれ、Slack は業務時間外に見ません。

承認待ち・障害・当日の予定変更のように、**開いていなくても届く**必要があるものに使います。

## なぜ自前で書くか

`web-push` パッケージは依存が多く、**これだけで 30 以上**入ります。
Web Push が要るのは VAPID の署名と本文の暗号化だけで、
どちらも **Node の `crypto` で足ります**(P-256 / HKDF / AES-128-GCM)。

## 3 つの落とし穴

### ① VAPID 鍵は変えられない

変えると**既存の購読がすべて無効**になります。利用者は「通知が来なくなった」としか分からず、
原因にたどり着けません。**一度作ったら変えない**前提で、秘密鍵は環境変数に置いてください。

### ② 無効な購読を消さないと溜まる

ブラウザを消した・通知を切った場合、送信先は **404 / 410** を返します。
これは異常ではなく**日常的に起きる**ので、`gone` が `true` なら保存先から消してください。

消さないと、**毎回送っては失敗するだけ**の購読が溜まり続けます。

```ts
const r = await broadcastPush(subs, message, { vapid });
for (const endpoint of r.gone) await store.remove(endpoint);
```

### ③ TTL は短すぎても長すぎても困る

端末がオフラインの間、送信先が預かる時間です(既定 1 日)。

- **短い** … 寝ている間の通知が消える
- **長い** … 古い情報が後から届く(「本日 10 時から会議」が翌日に届く)

## 扱わないもの

| | どこで |
|---|---|
| Service Worker の登録 | ブラウザ側(`@platform/mobile` の PWA) |
| 購読の保存 | アプリの DB(ここは形だけ決める) |
| iOS の制約 | **PWA としてホーム画面に追加しないと届かない**。案内は画面側で |

## 通知チャネルとして使う

`@platform/notify` の経路(メール・Slack・LINE)と同じ扱いにできます。

```ts
const push = createPushChannel(
  () => store.listAll(),
  (endpoint) => store.remove(endpoint),
  { vapid },
);
```
