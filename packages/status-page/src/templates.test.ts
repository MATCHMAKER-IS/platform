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
  it("undefined を明示しても既定文が消えない(スプレッド順の回帰)", () => {
    // options?.message のような optional chaining の結果をそのまま渡す形。
    // 既定値を先に書いてスプレッドで上書きすると、ここで本文が消える
    const h = renderMaintenancePage({ message: undefined, estimatedRecovery: "22:00" });
    expect(h).toContain("メンテナンス");
    expect(h).not.toContain("undefined");
    expect(h).toContain("22:00");
  });
  it("404 も message/action の undefined で既定が消えない", () => {
    const h = renderNotFoundPage({ message: undefined, action: undefined });
    expect(h).toContain("お探しのページ");
    expect(h).toContain('href="/"');
    expect(h).not.toContain("undefined");
  });
  it("指定した値は既定を上書きする(従来どおり)", () => {
    expect(renderErrorPage({ message: ["独自の文言"] })).toContain("独自の文言");
    expect(renderErrorPage({ showReload: false })).not.toContain("再読み込み");
  });
});
