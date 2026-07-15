# @platform/google

Google Workspace 連携の総合クライアント。**ログイン(OAuth)/ ユーザー情報 / Sheets /
Calendar / Gmail / Drive / Maps** を型付きで扱います。トークンは自動更新に対応。

## ログイン(OAuth)+ トークン管理
```ts
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
