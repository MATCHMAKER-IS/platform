import { describe, it, expect } from "vitest";
import { buildRawEmail } from "./gmail";
describe("gmail", () => {
  it("builds RFC822 with MIME-encoded subject", () => {
    const raw = buildRawEmail({ to: "a@x.com", subject: "テスト", text: "本文", cc: ["b@x.com"] });
    expect(raw).toContain("To: a@x.com");
    expect(raw).toContain("Cc: b@x.com");
    expect(raw).toContain("=?UTF-8?B?");
    expect(raw).not.toContain("テスト");
  });
  it("ascii subject stays plain, html sets content-type", () => {
    expect(buildRawEmail({ to: "a@x.com", subject: "Hello", text: "x" })).toContain("Subject: Hello");
    expect(buildRawEmail({ to: "a@x.com", subject: "s", html: "<b>x</b>" })).toContain("text/html");
  });
});
