import { describe, it, expect } from "vitest";
import { renderEmailTemplate, wrapHtmlEmail, escapeHtml, createTemplateMailer } from "./template";
describe("email template", () => {
  it("renders with HTML escaping on html only", () => {
    const r = renderEmailTemplate({ subject: "{{name}}様", html: "<p>{{name}}様</p>", text: "{{name}}様" }, { name: "山田<太郎>" });
    expect(r.subject).toBe("山田<太郎>様");
    expect(r.html).toBe("<p>山田&lt;太郎&gt;様</p>");
    expect(r.text).toBe("山田<太郎>様");
  });
  it("wraps and escapes correctly", () => {
    expect(escapeHtml("<a>&'\"")).toBe("&lt;a&gt;&amp;&#39;&quot;");
    const w = wrapHtmlEmail("<p>x</p>", { title: "T", preheader: "P" });
    expect(w).toContain("<!doctype html>");
    expect(w).toContain("<p>x</p>");
    expect(w).toContain("display:none");
  });
  it("template mailer sends rendered message", async () => {
    const sent: { to: string | string[]; subject: string; html?: string }[] = [];
    const mailer = { send: async (m: { to: string | string[]; subject: string; html?: string }) => { sent.push(m); return { ok: true }; } };
    const tm = createTemplateMailer(mailer, { welcome: { subject: "{{n}}", html: "<p>{{n}}</p>" } }, { layout: true });
    await tm.send("welcome", "u@x.com", { n: "田中" });
    expect(sent[0]!.subject).toBe("田中");
    expect(sent[0]!.html).toContain("<!doctype html>");
  });
});
