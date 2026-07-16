import { describe, it, expect } from "vitest";
import { resolveTheme, nextThemePreference, toggleTheme, applyTheme, THEME_LABELS, themeInitScript, THEME_STORAGE_KEY } from "./theme";
describe("ui theme lib", () => {
  it("resolves and cycles theme", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(nextThemePreference("light")).toBe("dark");
    expect(nextThemePreference("dark")).toBe("system");
    expect(nextThemePreference("system")).toBe("light");
    expect(toggleTheme("light")).toBe("dark");
    expect(THEME_LABELS.system).toBe("システム");
  });
  it("applies theme to an element", () => {
    const classes = new Set<string>();
    const attr: Record<string, string> = {};
    const el = { classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) }, setAttribute: (n: string, v: string) => { attr[n] = v; } };
    applyTheme("dark", el);
    expect(classes.has("dark")).toBe(true);
    expect(attr["data-theme"]).toBe("dark");
    applyTheme("light", el);
    expect(classes.has("dark")).toBe(false);
    expect(() => applyTheme("dark")).not.toThrow();
  });

  it("generates FOUC-prevention init script", () => {
    const script = themeInitScript();
    expect(script).toContain('"theme"');
    expect(script).toContain("prefers-color-scheme");
    expect(script).toContain('classList.add("dark")');
    expect(script).toContain("data-theme");
    expect(themeInitScript("myapp")).toContain('"myapp"');
    expect(THEME_STORAGE_KEY).toBe("theme");
  });
});
