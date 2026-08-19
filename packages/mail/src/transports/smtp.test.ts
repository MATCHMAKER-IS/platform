import { describe, it, expect, vi } from "vitest";

/** nodemailer に渡された設定を捕まえる。 */
const captured: Record<string, unknown>[] = [];
/** `sendMail` に渡された引数を捕まえる(添付の変換確認用)。 */
const sentMail: Record<string, unknown>[] = [];
vi.mock("nodemailer", () => ({
  default: {
    createTransport: (opts: Record<string, unknown>) => {
      captured.push(opts);
      return {
        sendMail: async (mail: Record<string, unknown>) => {
          sentMail.push(mail);
          return { messageId: "x" };
        },
      };
    },
  },
}));

const { createSmtpTransport } = await import("./smtp");

describe("SMTP: 暗号化できないときに送らない", () => {
  // **nodemailer の既定は `requireTLS: false`。**
  // port 587 で STARTTLS に対応していないサーバだと**平文で送る**——
  // 認証情報も本文もそのままネットワークを流れる
  it("認証情報があれば TLS を必須にする", () => {
    captured.length = 0;
    createSmtpTransport({ host: "smtp.example.jp", port: 587, user: "u", pass: "p" });
    expect(captured[0]?.requireTLS).toBe(true);
  });

  // **ローカルの MailHog / Mailpit を壊さない。** 認証なしなら従来どおり
  it("認証情報が無ければ必須にしない", () => {
    captured.length = 0;
    createSmtpTransport({ host: "localhost", port: 1025 });
    expect(captured[0]?.requireTLS).toBe(false);
  });

  // **465 は接続時から TLS(SMTPS)**。それ以外は STARTTLS で昇格する
  it("465 は secure、それ以外は false", () => {
    captured.length = 0;
    createSmtpTransport({ host: "h", port: 465, user: "u", pass: "p" });
    expect(captured[0]?.secure).toBe(true);
    captured.length = 0;
    createSmtpTransport({ host: "h", port: 587, user: "u", pass: "p" });
    expect(captured[0]?.secure).toBe(false);
  });

  // **明示的に切れる。** どうしても平文が要る環境のため
  it("requireTls: false で上書きできる", () => {
    captured.length = 0;
    createSmtpTransport({ host: "h", port: 587, user: "u", pass: "p", requireTls: false });
    expect(captured[0]?.requireTLS).toBe(false);
  });
});

describe("SMTP: 添付ファイルの content を Buffer に変換する", () => {
  // **`MailAttachment.content` は `string | Uint8Array`(汎用型)だが、
  // nodemailer は Node 固有の `Buffer` を要求する。プレーンな
  // `Uint8Array` のままだと `pnpm install` 後の型検査で落ちる
  // (2026-08 に発見・修正)。ここでは実行時の変換が正しく行われる
  // ことを確認する。
  it("Uint8Array の content を Buffer に変換して渡す", async () => {
    sentMail.length = 0;
    const transport = createSmtpTransport({ host: "h", port: 587 });
    const bytes = new Uint8Array([1, 2, 3]);
    await transport.send({
      from: "a@x.jp", to: "b@x.jp", subject: "件名",
      attachments: [{ filename: "f.bin", content: bytes }],
    });
    const sent = sentMail[0];
    const atts = sent?.["attachments"] as Array<{ filename: string; content: unknown }>;
    expect(Buffer.isBuffer(atts[0]?.content)).toBe(true);
    expect(Array.from(atts[0]?.content as Buffer)).toEqual([1, 2, 3]);
  });

  it("文字列の content はそのまま渡す(変換しない)", async () => {
    sentMail.length = 0;
    const transport = createSmtpTransport({ host: "h", port: 587 });
    await transport.send({
      from: "a@x.jp", to: "b@x.jp", subject: "件名",
      attachments: [{ filename: "f.txt", content: "aGVsbG8=", encoding: "base64" }],
    });
    const sent = sentMail[0];
    const atts = sent?.["attachments"] as Array<{ content: unknown }>;
    expect(atts[0]?.content).toBe("aGVsbG8=");
  });

  it("attachments が無ければ何も渡さない", async () => {
    sentMail.length = 0;
    const transport = createSmtpTransport({ host: "h", port: 587 });
    await transport.send({ from: "a@x.jp", to: "b@x.jp", subject: "件名" });
    expect(sentMail[0]?.["attachments"]).toBeUndefined();
  });
});
