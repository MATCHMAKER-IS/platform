import { describe, it, expect } from "vitest";
import { createI18n, detectLocale, mergeCatalogs } from "./index";

const i18n = createI18n({
  locale: "ja",
  fallbackLocale: "en",
  catalogs: {
    ja: { greeting: "こんにちは、{name}さん" },
    en: { greeting: "Hello, {name}", only_en: "English only" },
  },
});

describe("i18n", () => {
  it("interpolates and translates", () => {
    expect(i18n.t("greeting", { name: "山田" })).toBe("こんにちは、山田さん");
  });
  it("falls back to fallback locale for missing keys", () => {
    expect(i18n.t("only_en")).toBe("English only");
  });
  it("returns key itself when missing everywhere", () => {
    expect(i18n.t("nonexistent")).toBe("nonexistent");
  });
  it("formats currency by locale", () => {
    expect(i18n.currency(1980, "JPY")).toContain("1,980");
  });
  it("detects locale from Accept-Language with fallback", () => {
    expect(detectLocale("ja-JP,en;q=0.9")).toBe("ja");
    expect(detectLocale("fr-FR", "en")).toBe("en");
    expect(detectLocale(undefined, "ja")).toBe("ja");
  });
  it("merges catalogs", () => {
    const merged = mergeCatalogs({ ja: { a: "A" } }, { ja: { b: "B" } });
    expect(merged.ja).toMatchObject({ a: "A", b: "B" });
  });
});
