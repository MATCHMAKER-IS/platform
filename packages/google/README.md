# @platform/google

Google Workspace（Drive / Gmail / Sheets / Calendar / Maps / Docs / Forms / Apps Script）。

## これは何のためか

**社内にすでに Google の資産があります**——
議事録の雛形、申請フォーム、スプレッドシートのマクロ。

**全部を作り直すのは現実的でない**ので、**そのまま使えるように**します。

## 使う前に知っておくこと

| | |
|---|---|
| **スコープはサービスごとに別** | 足りないスコープで呼ぶと **403**——「認証したのに動かない」の多くはこれです |
| **10 秒で切れます** | 相手が応答しないとき**永久に待たない**ためです——**利用者は白い画面のまま**になります |
| **Docs の雛形は複製してから差し込む** | そのまま差し込むと**雛形が壊れます** |
| **Forms の質問名で対応付けない** | **総務の人が質問文を直した瞬間に壊れます**——**質問 ID** を控えてください |
| **Apps Script はエラーを 200 で返します** | HTTP は成功でも**本文に `error`** が入ります——`ok` だけ見て安心しないでください |

## よく使うもの

```ts
import { createGoogleDriveClient, createGoogleSheetsClient } from "@platform/google";
import { buildGoogleAuthUrl, exchangeGoogleCode, createGoogleTokenManager, createGoogleAuthedFetch, getGoogleUserInfo } from "@platform/google";

// 1) ログイン画面へ誘導
const url = buildGoogleAuthUrl({ clientId, redirectUri, scopes: ["openid", "email", "https://www.googleapis.com/auth/calendar"], state, forceConsent: true });

// 2) コールバックでコード交換
const tokens = await exchangeGoogleCode({ clientId, clientSecret, code, redirectUri });
const user = await getGoogleUserInfo(tokens.accessToken); // user.email / user.hd(社内ドメイン判定)

// 3) 以降は自動更新トークンで各 API を叩く
const manager = createGoogleTokenManager({ clientId, clientSecret, refreshToken: tokens.refreshToken!, onRefresh: (t) => db.save(t) });
const authedFetch = createGoogleAuthedFetch(manager);
```
`getGoogleUserInfo` の `hd`(ホストドメイン)で社内アカウントかを判定でき、SSO に使えます。

## Gmail(送信・検索)
```ts
import { createGmailClient } from "@platform/google";
const gmail = createGmailClient({ accessToken, fetchImpl: authedFetch });
await gmail.sendEmail({ to: "a@example.com", subject: "承認のお願い", html: "<p>ご確認ください</p>" });
await gmail.listMessages({ q: "from:boss is:unread", maxResults: 10 });
```
日本語件名は自動で MIME エンコード。本文は base64url で送信します。

## Drive(アップロード・共有)
```ts
import { createGoogleDriveClient } from "@platform/google";
const drive = createGoogleDriveClient({ accessToken, fetchImpl: authedFetch });
const file = await drive.uploadFile({ name: "報告書.pdf", data: bytes, mimeType: "application/pdf", parents: [folderId] });
await drive.shareFile(file.value.id, { role: "reader", type: "user", emailAddress: "taro@example.com" });
```
一覧/取得/ダウンロード/フォルダ作成/権限付与/削除に対応。

## Calendar(予定 CRUD・空き照会)
```ts
const cal = createGoogleCalendarClient({ accessToken, fetchImpl: authedFetch });
await cal.createEvent("primary", { summary: "会議", start: {...}, end: {...} }, { sendUpdates: "all" });
await cal.freeBusy({ timeMin, timeMax, calendarIds: ["primary", "room@example.com"] });
```
listEvents / createEvent / updateEvent / deleteEvent / freeBusy。

## Sheets / Maps
`createGoogleSheetsClient`(getValues/appendRows/updateRows)、
`createGoogleMapsClient`(geocode/reverseGeocode/directions/distanceMatrix。Maps は API キー認証)。

全クライアントが `fetchImpl` を受け取り、トークンマネージャや耐障害ラッパーと合成できます。
