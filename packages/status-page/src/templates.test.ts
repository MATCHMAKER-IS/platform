import { describe, it, expect } from "vitest";
import { renderMaintenancePage, renderErrorPage, renderNotFoundPage, renderStatusPage } from "./templates";
describe("status page templates", () => {
  it("renders self-contained maintenance HTML", () => {
    const h = renderMaintenancePage({ estimatedRecovery: "22:00" });
    expect(h.startsWith("<!doctype html>")).toBe(true);
    expect(h).toContain("メンテナンス中");
    expect(h).toContain("22:00");
    expect(h).toContain("noindex");
    expect(h).not.toMatch(/src=|href="https?:/);
  });
  it("error page shows reference id", () => {
    expect(renderErrorPage({ referenceId: "t-1" })).toContain("t-1");
  });
  it("escapes html (xss)", () => {
    const h = renderStatusPage({ title: "<script>x</script>", message: "a & b" });
    expect(h).toContain("&lt;script&gt;");
    expect(h).toContain("a &amp; b");
    expect(h).not.toContain("<script>x");
  });
  it("not found has home link", () => {
    expect(renderNotFoundPage()).toContain('href="/"');
  });
});
