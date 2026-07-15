# @demos/cast-site — キャスト予約サイトの実装例

基盤パッケージを組み合わせてキャスト予約サイトの各画面データを組み立てる例です。
ロジックは基盤側にあり、この層は「どう束ねるか」を示す薄い配線です。

| 画面 / 処理 | 関数 | 使う基盤 |
| --- | --- | --- |
| トップ(注目・新人・ランキング) | `buildHomePage` | `@platform/cast`(featured/newcomers/rankCasts/tagCounts) |
| キャスト個別ページ | `buildCastPage` | `cast`(profile) + `social`(SNSリンク/最新投稿) + `seo`(公開メタ) |
| 指名予約の空き枠 | `buildCastAvailability` | `booking`(generateSlots + staffAvailableSlots) |
| 予約可否の検証 | `validateBookingRequest` | `booking`(isWithinBookingWindow) |
| 予約リマインダー | `scheduleBookingReminders` | `booking`(reminderSchedule) |
| キャンセル可否 | `canCancelBooking` | `booking`(canCancel) |

## 全体の流れ
1. **トップ**: `buildHomePage(casts)` → 注目キャスト・新人・口コミ連動ランキング(件数補正済み)・タグ絞り込み。
2. **個別ページ**: `buildCastPage(cast, { socialUrls, posts, fields, baseUrl })` → プロフィール項目・充実度・
   X/TikTok/Instagram リンク・各SNSの最新投稿・公開ページ用メタ(`visibility: "public"`)。
3. **予約**: `buildCastAvailability({ openingHours, shifts, bookings, slotMinutes })` で
   店のスロット × キャストのシフト − 既存予約 = 指名予約の空き枠。`validateBookingRequest` で受付可否。
4. **予約確定後**: `scheduleBookingReminders(bookingAt)` で前日メール + 2時間前SMS を計算(送信は cron + mail/sms)。

社内管理画面として使うなら `buildCastPage` の `visibility` を `"internal"` にすれば検索避けになります。

## ソーシャルログインの認証フロー(auth-flow.ts）
`@platform/ui` の `LoginCard`(Google/Zoho)からの遷移を受け、認証を完了させる例です。

| 段階 | 関数 | 使う基盤 |
| --- | --- | --- |
| ① 認可URL生成(リダイレクト先) | `authorizeUrl(provider, config, state)` | `@platform/google`(buildGoogleAuthUrl) / `@platform/zoho/core`(buildAuthorizationUrl) |
| ② コールバック(コード交換+ユーザー情報) | `completeLogin(provider, code, config)` | `google`(exchangeGoogleCode/getGoogleUserInfo) / `zoho/core`(exchangeCodeForToken/getUserInfo) |
| ③ セッション確立 | `establishSession(identity, store, getOrCreateUser)` | `@platform/session`(createServerSession) |

Google と Zoho の差(戻り値の形・Result 型)を `SocialIdentity` に正規化して吸収します。
社内アプリのログインなので、ログインページ自体は検索避け(`visibility: "internal"`)を適用します。
`fetchImpl` を差し替えればテスト可能で、実 API 呼び出しはアプリ実行時に行われます。

