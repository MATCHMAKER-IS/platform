/**
 * メールテンプレート。件名・本文(HTML/テキスト)を {{変数}} 差し込みで生成する。
 * HTML 本文の差し込み値は自動でエスケープし、注入を防ぐ。標準の HTML レイアウトも提供。
 * @packageDocumentation
 */
import type { MailMessage } from "./index.js";

/** メールテンプレート。件名は必須、本文は HTML / テキストの一方または両方。 */
export interface EmailTemplate {
  /** 件名({{変数}} 可)。 */
  subject: string;
  /** HTML 本文({{変数}} 可・値は自動エスケープ)。 */
  html?: string;
  /** テキスト本文({{変数}} 可)。 */
  text?: string;
}

/** レンダリング結果。 */
export interface RenderedEmail {
  subject: string;
  html?: string;
  text?: string;
}

/** HTML の特殊文字をエスケープする。 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** {{ key }} / {{ a.b }} を values から差し込む。escape=true で HTML エスケープ。 */
function interpolate(template: string, values: Record<string, unknown>, escape: boolean): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const v = key.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), values);
    if (v == null) return "";
    const s = String(v);
    return escape ? escapeHtml(s) : s;
  });
}

/**
 * テンプレートを差し込んで件名・本文を生成する。
 * HTML 本文の変数は自動エスケープ、件名・テキストはそのまま差し込む。
 */
export function renderEmailTemplate(template: EmailTemplate, values: Record<string, unknown>): RenderedEmail {
  return {
    subject: interpolate(template.subject, values, false),
    ...(template.html !== undefined ? { html: interpolate(template.html, values, true) } : {}),
    ...(template.text !== undefined ? { text: interpolate(template.text, values, false) } : {}),
  };
}

/** {@link wrapHtmlEmail} のオプション。 */
export interface HtmlEmailLayoutOptions {
  /** ページタイトル(<title> と冒頭見出し)。 */
  title?: string;
  /** プレヘッダ(受信一覧のプレビュー文・本文には非表示)。 */
  preheader?: string;
  /** フッタ(会社名・住所・配信停止リンク等の HTML)。 */
  footerHtml?: string;
  /** 基調色(見出し・ボタン)。 */
  accentColor?: string;
}

/**
 * 本文 HTML を、レスポンシブな標準メールレイアウトで包む。
 * bodyHtml は既にエスケープ済み/信頼できる HTML であること(renderEmailTemplate の html はエスケープ済み)。
 */
export function wrapHtmlEmail(bodyHtml: string, options: HtmlEmailLayoutOptions = {}): string {
  const accent = options.accentColor ?? "#2563eb";
  const title = options.title ?? "";
  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(options.preheader)}</div>`
    : "";
  const footer = options.footerHtml
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.6">${options.footerHtml}</div>`
    : "";
  const heading = title ? `<h1 style="margin:0 0 16px;font-size:20px;color:${accent}">${escapeHtml(title)}</h1>` : "";
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;padding:32px;font-family:'Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic',sans-serif;color:#0f172a;font-size:14px;line-height:1.7">
<tr><td>
${heading}
${bodyHtml}
${footer}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

/**
 * テンプレート名で送信できる Mailer ラッパー。
 * 送信先・差し込み値・(任意で)レイアウトを渡すと、件名・本文を生成して送る。
 */
export interface TemplateMailerOptions {
  /** HTML をレイアウトで包む(true か レイアウトオプション)。 */
  layout?: boolean | HtmlEmailLayoutOptions;
  /** 差出人。 */
  from?: string;
}

/** テンプレートメーラー。 */
export interface TemplateMailer<K extends string = string> {
  send(templateName: K, to: string | string[], values: Record<string, unknown>): ReturnType<Sendable["send"]>;
}

/** send を持つ最小の Mailer 形(型依存を減らすため）。 */
interface Sendable {
  send(message: MailMessage): Promise<unknown>;
}

/**
 * テンプレート集を登録した Mailer を作る。
 * @example
 * ```ts
 * const tm = createTemplateMailer(mailer, {
 *   welcome: { subject: "{{name}}さん、ようこそ", html: "<p>{{name}}さん、登録ありがとうございます。</p>" },
 * }, { layout: { title: "ようこそ" } });
 * await tm.send("welcome", "user@example.com", { name: "山田" });
 * ```
 */
export function createTemplateMailer<M extends Sendable, T extends Record<string, EmailTemplate>>(
  mailer: M,
  templates: T,
  defaults: TemplateMailerOptions = {},
): TemplateMailer<Extract<keyof T, string>> {
  return {
    send(templateName, to, values) {
      const template = templates[templateName];
      if (!template) throw new Error(`テンプレートが見つかりません: ${String(templateName)}`);
      const rendered = renderEmailTemplate(template, values);
      let html = rendered.html;
      if (html !== undefined && defaults.layout) {
        const layoutOpts = defaults.layout === true ? {} : defaults.layout;
        html = wrapHtmlEmail(html, layoutOpts);
      }
      const message: MailMessage = {
        to,
        subject: rendered.subject,
        ...(rendered.text !== undefined ? { text: rendered.text } : {}),
        ...(html !== undefined ? { html } : {}),
        ...(defaults.from ? { from: defaults.from } : {}),
      };
      return mailer.send(message) as ReturnType<Sendable["send"]>;
    },
  };
}
