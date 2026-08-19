# @platform/mail

メール送信（SMTP・テンプレート・添付）。

## これは何のためか

**送れなかったことに気づけないのが一番困ります。**

「案内を送ったのに来ていない」——**送信側は成功したつもり**で、
**受信側は届いていない**。この食い違いを減らすためのものです。

## 使う前に知っておくこと

| | |
|---|---|
| **Outbox 経由で送る** | 直接送ると、**失敗したときに「送ったか」が分かりません** |
| **開発中は MailHog に届きます** | `http://localhost:8025` で見られます——**本物には飛びません** |
| **宛先を間違えると取り返せません** | 送信前に**宛先を画面に出して**確認させてください |
| **添付は 10MB まで** | 超えると**相手のサーバで弾かれます**。大きいものは**リンクで渡して**ください |
| **BCC を使う** | 複数人に送るとき TO や CC にすると、**全員のメールアドレスが互いに見えます** |

## よく使うもの

```ts
import { isAllowedRecipient, filterRecipients, applyRecipientPolicy } from "@platform/mail";
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

