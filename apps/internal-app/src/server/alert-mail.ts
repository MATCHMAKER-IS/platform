/**
 * 運用アラートのメール整形。アラート一覧を 1 通のメール（件名・本文）に組み立てる。純粋な組み立てのみ。
 * @packageDocumentation
 */
import { type Alert } from "./alerts.js";
import { type MailMessage } from "@platform/mail";

/** アラート一覧を宛先向けのメールに整形する。 */
export function alertsEmail(to: string, alerts: Alert[]): MailMessage {
  const subject = `【要対応】運用アラート ${alerts.length}件`;
  const text = alerts.map((a) => `・[${a.level === "warning" ? "警告" : "情報"}] ${a.title}\n  ${a.body}`).join("\n\n");
  const html = `<h2>運用アラート ${alerts.length}件</h2><ul>${alerts.map((a) => `<li><strong>${a.title}</strong><br>${a.body}</li>`).join("")}</ul>`;
  return { to, subject, text, html };
}
