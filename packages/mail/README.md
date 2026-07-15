# @platform/mail

メール送信の共通部品(Adapter パターン)。アプリは送信基盤を意識せず `sendMail()` を呼びます。

- `createSmtpTransport` … 本番/ローカル(MailHog/Mailpit)向け SMTP
- `createMemoryTransport` … テスト・デバッグ用(送信内容を配列に記録)

送信基盤(SES/Resend 等)を足す時は `MailTransport` を実装するだけで、アプリは無変更です。

## テンプレートメール
件名・本文を {{変数}} 差し込みで生成します。**HTML 本文の差し込み値は自動エスケープ**(注入対策)、件名・テキストは生で差し込みます。
```ts
import { createTemplateMailer } from "@platform/mail";
const tm = createTemplateMailer(mailer, {
  welcome: { subject: "{{name}}さん、ようこそ", html: "<p>{{name}}さん、登録ありがとうございます。</p>" },
  invoice: { subject: "請求書のご案内({{month}}月分)", html: "<p>金額: {{amount}}円</p>" },
}, { layout: { title: "お知らせ" }, from: "noreply@example.co.jp" });

await tm.send("welcome", "user@example.com", { name: "山田" });
```
`wrapHtmlEmail(bodyHtml, { title, preheader, footerHtml })` でレスポンシブな標準レイアウトに包めます
(プレヘッダ=受信一覧のプレビュー文にも対応)。

## 宛先ホワイトリスト(受信者ポリシー)
許可したアドレス/ドメインだけに送信を絞れます。**ステージングで実顧客への誤送信を防ぐ**、社内ドメイン限定で送る、などに。
```ts
import { withRecipientPolicy } from "@platform/mail";

// 本番: 社内ドメインのみ許可、退職者はブロック
const safe = withRecipientPolicy(mailer, {
  allowedDomains: ["example.co.jp"],
  blockedEmails: ["leaver@example.co.jp"],
}, { onBlocked: (blocked) => log.warn("送信ブロック", { blocked }) });

// ステージング: 全メールを検証アドレスに集約(誤送信ゼロ)
const staging = withRecipientPolicy(mailer, {}, { redirectTo: "qa@example.co.jp" });
```
ブロックが許可より優先。送信可能な宛先が無いメールは送らずスキップします。
`applyRecipientPolicy` / `filterRecipients` / `isAllowedRecipient` を直接使うこともできます。すべて純ロジック。

## 添付ファイル
```ts
import { attachmentFromBase64, validateAttachments } from "@platform/mail";
const pdf = attachmentFromBase64("請求書.pdf", base64);  // 種別はファイル名から推定
const check = validateAttachments([pdf], { maxTotalBytes: 10*1024*1024, blockedExtensions: ["exe","js"] });
if (check.ok) await mailer.send({ to, subject, html, attachments: [pdf] });
```
`attachmentFromBytes` / `inlineImage`(HTML から `cid:` で参照)、`totalAttachmentSize`、種別・件数・サイズ・拡張子の `validateAttachments` を提供。base64 は復号後の実サイズで判定します。

## 配信停止(unsubscribe)
**改ざん不可な署名トークン**で配信停止リンクを生成・検証し、RFC 8058 のワンクリック配信停止にも対応します。
```ts
import { unsubscribeUrl, verifyUnsubscribeToken, listUnsubscribeHeaders, removeSuppressed } from "@platform/mail";

// 送信時: 配信停止リンク + List-Unsubscribe ヘッダ
const url = unsubscribeUrl("https://app.example.com/unsub", to, secret, { category: "newsletter" });
await mailer.send({ to, subject, html, headers: listUnsubscribeHeaders({ url, oneClick: true }) });

// 受信エンドポイント: トークン検証
const v = verifyUnsubscribeToken(req.query.token, secret);
if (v.valid) addToSuppressionList(v.email, v.category);

// 送信前: 配信停止済みを除外
const { sendable } = removeSuppressed(recipients, suppressedSet);
```
カテゴリを分ければ「特定の配信種別だけ停止」も表現できます。トークンは HMAC 署名で偽造できません。

