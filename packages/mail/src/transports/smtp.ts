/**
 * SMTP 用 Transport。nodemailer をこのファイル内だけで使い、
 * 上位(アプリ)から nodemailer を隠蔽する。
 * @packageDocumentation
 */
import nodemailer from "nodemailer";
import type { MailTransport } from "../index";

/** SMTP 接続設定。 */
export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  /**
   * 暗号化できないときに送信を中止するか。
   *
   * **既定は「認証情報があるなら必須」**。認証なしのローカル SMTP
   * (MailHog / Mailpit)を壊さず、本番の平文送信だけを止める。
   * どうしても平文で送る必要があるなら明示的に `false` にすること。
   */
  requireTls?: boolean;
}

/**
 * SMTP Transport を作る。
 * @param config 接続設定
 * @returns {@link MailTransport} 実装
 */
export function createSmtpTransport(config: SmtpConfig): MailTransport {
  // **暗号化できなければ送らない。** nodemailer の既定は
  // `secure` が port 465 のときだけ true、`requireTLS` は false。
  // port 587(STARTTLS の標準)だと、**サーバが STARTTLS に対応していなければ
  // 平文で送る**——認証情報も本文もそのままネットワークを流れる。
  //
  // 認証情報がある = 外部の SMTP を使っているとみなして必須にする。
  // 認証なしのローカル SMTP(MailHog / Mailpit)は従来どおり動く。
  const requireTls = config.requireTls ?? config.user !== undefined;
  const t = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // 465 は接続時から TLS(SMTPS)。それ以外は STARTTLS で昇格する
    secure: config.port === 465,
    requireTLS: requireTls,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
  return {
    async send(message) {
      await t.sendMail({
        from: message.from,
        to: message.to,
        // **bcc / cc を落とさない。** 型に足しても送信側で渡さなければ
        // 一斉配信が届かない(2026-08)
        ...(message.bcc !== undefined ? { bcc: message.bcc } : {}),
        ...(message.cc !== undefined ? { cc: message.cc } : {}),
        subject: message.subject,
        text: message.text,
        html: message.html,
        // **添付を落とさない。** 型に `attachments` があるのに送信側で渡しておらず、
        // **添付したつもりのメールが本文だけで届いていた**(2026-08 に修正)。
        // 請求書や明細を送る経路では、受け取る側は「添付漏れ」と受け取る。
        //
        // **`content` を `Buffer` に変換する。** `MailAttachment.content` は
        // `string | Uint8Array`(ブラウザ/Edge でも使える汎用型)だが、
        // nodemailer は Node 固有の `Buffer`(`Uint8Array` を継承する
        // ラッパー)を要求する——プレーンな `Uint8Array` では
        // `Buffer` が持つ追加メソッドが無いため型が合わない。
        // ここ(Node 専用の実装詳細)でだけ変換し、公開契約は変えない
        // (2026-08、`pnpm install` 後の型検査で発見)。
        ...(message.attachments !== undefined
          ? {
              attachments: message.attachments.map((a) => ({
                ...a,
                content: typeof a.content === "string" ? a.content : Buffer.from(a.content),
              })),
            }
          : {}),
        // **追加ヘッダを落とさない。** `unsubscribe.ts` が `List-Unsubscribe` を
        // 作っているのに送信側で渡しておらず、**ヘッダが付かないまま届いて**いた。
        // Gmail は 2024 年から一斉配信にこのヘッダを求めており、
        // 無いと**迷惑メール扱いで届かない**——「お知らせが誰にも届かない」
        // という形で表面化する(2026-08 に修正)。
        ...(message.headers !== undefined ? { headers: message.headers } : {}),
      });
    },
  };
}
