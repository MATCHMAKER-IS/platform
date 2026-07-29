import { describe, it, expect } from "vitest";
import {
  isValidThemeId, themeToCssVars, cssVarsToString, themeToCssBlock, buildThemeStylesheet, applySkin,
  createThemeRegistry, defaultTheme, builtInThemes,
  checkThemeContrast, checkTheme, findContrastIssues,
  deriveTheme, validateTheme, parseTheme, themeToJson, themesToJson, themesFromJson,
  type Theme,
} from "./index";

/** 検査用の最小テーマ。 */
const sample: Theme = {
  id: "sample",
  name: "見本",
  shape: { fontFamily: "sans-serif", radius: 8, spacing: 4, elevation: 1 },
  modes: {
    light: {
      bg: "#ffffff", fg: "#111111", muted: "#666666", surface: "#f7f7f7", border: "#dddddd",
      primary: "#0d6efd", primaryFg: "#ffffff", accent: "#6610f2",
      success: "#198754", warning: "#ffc107", danger: "#dc3545",
    },
    dark: {
      bg: "#111111", fg: "#f5f5f5", muted: "#aaaaaa", surface: "#1c1c1c", border: "#333333",
      primary: "#4d94ff", primaryFg: "#000000", accent: "#a78bfa",
      success: "#4ade80", warning: "#fbbf24", danger: "#f87171",
    },
  },
};

describe("isValidThemeId", () => {
  it("英数字・ハイフン・アンダースコアを許す", () => {
    expect(isValidThemeId("corporate")).toBe(true);
    expect(isValidThemeId("navy-sidebar")).toBe(true);
    expect(isValidThemeId("skin_1")).toBe(true);
  });

  it("**セレクタを壊す文字は拒否する**(data-skin 属性と CSS に入るため)", () => {
    // 許すと任意の CSS を注入されうる
    expect(isValidThemeId('a"]{color:red}')).toBe(false);
    expect(isValidThemeId("my skin")).toBe(false);
    expect(isValidThemeId("skin.1")).toBe(false);
    expect(isValidThemeId("")).toBe(false);
  });

  it("先頭は英数字のみ・40 文字まで", () => {
    expect(isValidThemeId("-lead")).toBe(false);
    expect(isValidThemeId("_lead")).toBe(false);
    expect(isValidThemeId("a".repeat(40))).toBe(true);
    expect(isValidThemeId("a".repeat(41))).toBe(false);
  });
});

describe("themeToCssVars", () => {
  it("色・フォント・角丸・影を CSS 変数にする", () => {
    const vars = themeToCssVars(sample, "light");
    expect(vars["--color-bg"]).toBe("#ffffff");
    expect(vars["--color-primary"]).toBe("#0d6efd");
    expect(vars["--font-family"]).toBe("sans-serif");
    expect(vars["--radius"]).toBe("8px");
  });

  it("モードで値が変わる", () => {
    expect(themeToCssVars(sample, "dark")["--color-bg"]).toBe("#111111");
  });

  it("**`--spacing` ではなく `--space` を出す**(Tailwind の間隔スケールを壊さない)", () => {
    // Tailwind CSS 4 は --spacing を p-4 等の基準に使う。上書きすると
    // ユーティリティ全部が倍率変化する(h-10=40px が 80px になった)
    const vars = themeToCssVars(sample, "light");
    expect(vars["--space"]).toBe("4px");
    expect(vars["--spacing"]).toBeUndefined();
  });

  it("見出しフォント未指定なら本文フォントを流用する", () => {
    expect(themeToCssVars(sample, "light")["--font-heading"]).toBe("sans-serif");
    const withHeading = { ...sample, shape: { ...sample.shape, headingFontFamily: "serif" } };
    expect(themeToCssVars(withHeading, "light")["--font-heading"]).toBe("serif");
  });

  it("**任意の色は未指定なら変数を出さない**(CSS 側の既定値を効かせるため)", () => {
    // 空文字を入れると var(--x, 既定) の第 2 引数が効かなくなる
    expect(themeToCssVars(sample, "light")["--color-sidebar-bg"]).toBeUndefined();
    const withSidebar: Theme = {
      ...sample,
      modes: { ...sample.modes, light: { ...sample.modes.light, sidebarBg: "#001133" } },
    };
    expect(themeToCssVars(withSidebar, "light")["--color-sidebar-bg"]).toBe("#001133");
  });

  it("空文字の色も出さない", () => {
    const empty: Theme = {
      ...sample,
      modes: { ...sample.modes, light: { ...sample.modes.light, sidebarBg: "" } },
    };
    expect(themeToCssVars(empty, "light")["--color-sidebar-bg"]).toBeUndefined();
  });
});

describe("CSS の組み立て", () => {
  it("cssVarsToString は宣言だけを返す(セレクタは含まない)", () => {
    expect(cssVarsToString({ "--a": "1", "--b": "2" })).toBe("--a: 1; --b: 2;");
  });

  it("themeToCssBlock は既定で :root", () => {
    expect(themeToCssBlock(sample, "light").startsWith(":root { ")).toBe(true);
  });

  it("セレクタを指定できる", () => {
    expect(themeToCssBlock(sample, "light", ".x").startsWith(".x { ")).toBe(true);
  });

  it("buildThemeStylesheet は スキン × light/dark を全部出す", () => {
    const css = buildThemeStylesheet([sample]);
    expect(css).toContain('[data-skin="sample"][data-theme="light"]');
    expect(css).toContain('[data-skin="sample"][data-theme="dark"]');
    expect(css.split("\n").length).toBe(2);
  });

  it("組み込みテーマすべてを 1 枚に出せる", () => {
    const css = buildThemeStylesheet(builtInThemes);
    expect(css.split("\n").length).toBe(builtInThemes.length * 2);
  });
});

describe("applySkin", () => {
  /** documentElement の代わり(setAttribute / style.setProperty だけ持つ)。 */
  const fakeElement = () => {
    const attrs: Record<string, string> = {};
    const props: Record<string, string> = {};
    return {
      attrs, props,
      setAttribute: (k: string, v: string) => { attrs[k] = v; },
      style: { setProperty: (k: string, v: string) => { props[k] = v; } },
    };
  };

  it("data-skin / data-theme を立てる", () => {
    const el = fakeElement();
    applySkin(sample, "dark", el);
    expect(el.attrs["data-skin"]).toBe("sample");
    expect(el.attrs["data-theme"]).toBe("dark");
  });

  it("CSS 変数も直接セットする(スタイルシートを注入しない構成でも動く)", () => {
    const el = fakeElement();
    applySkin(sample, "light", el);
    expect(el.props["--color-primary"]).toBe("#0d6efd");
  });

  it("**要素が無ければ何もしない**(SSR で落ちない)", () => {
    expect(() => applySkin(sample, "light", undefined)).not.toThrow();
  });
});

describe("createThemeRegistry", () => {
  it("登録した順に一覧を返す", () => {
    const r = createThemeRegistry({ themes: [sample, { ...sample, id: "second" }] });
    expect(r.ids()).toEqual(["sample", "second"]);
  });

  it("同じ id は上書きし、順序は保つ", () => {
    const r = createThemeRegistry({ themes: [sample] });
    r.register({ ...sample, name: "差し替え" });
    expect(r.ids()).toEqual(["sample"]);
    expect(r.get("sample")?.name).toBe("差し替え");
  });

  it("不正な id は VALIDATION で拒否する", () => {
    const r = createThemeRegistry();
    let code = "";
    try { r.register({ ...sample, id: "bad id" }); }
    catch (e) { code = (e as { code?: string }).code ?? ""; }
    expect(code).toBe("VALIDATION");
  });

  it("既定 id は最初に登録したもの", () => {
    expect(createThemeRegistry({ themes: [sample, { ...sample, id: "b" }] }).getDefaultId()).toBe("sample");
  });

  it("既定を明示指定できる", () => {
    const r = createThemeRegistry({ themes: [sample, { ...sample, id: "b" }], defaultId: "b" });
    expect(r.getDefaultId()).toBe("b");
  });

  it("未登録の id を既定にしようとすると NOT_FOUND", () => {
    const r = createThemeRegistry({ themes: [sample] });
    let code = "";
    try { r.setDefault("nope"); }
    catch (e) { code = (e as { code?: string }).code ?? ""; }
    expect(code).toBe("NOT_FOUND");
  });

  it("has / get は未登録なら false / undefined", () => {
    const r = createThemeRegistry({ themes: [sample] });
    expect(r.has("sample")).toBe(true);
    expect(r.has("nope")).toBe(false);
    expect(r.get("nope")).toBeUndefined();
  });

  it("resolve は不明な id でも**既定にフォールバックする**(画面を白くしない)", () => {
    const r = createThemeRegistry({ themes: [sample] });
    expect(r.resolve("nope")?.id).toBe("sample");
    expect(r.resolve(undefined)?.id).toBe("sample");
  });
});

describe("コントラスト検査", () => {
  it("テキスト系のペアを検査し、比率と合否を返す", () => {
    const report = checkThemeContrast(sample, "light");
    expect(report.themeId).toBe("sample");
    expect(report.checks.length).toBeGreaterThan(0);
    expect(report.minRatio).toBeGreaterThan(1);
  });

  it("light / dark の両方を検査する(片方だけでは見落とす)", () => {
    expect(checkTheme(sample).map((r) => r.mode)).toEqual(["light", "dark"]);
  });

  it("**読めない配色を検出する**", () => {
    const unreadable: Theme = {
      ...sample,
      id: "unreadable",
      modes: {
        ...sample.modes,
        light: { ...sample.modes.light, bg: "#ffffff", fg: "#f2f2f2" }, // 白地に白
      },
    };
    const report = checkThemeContrast(unreadable, "light");
    expect(report.passesAA).toBe(false);
    expect(report.checks.some((c) => c.level === "fail")).toBe(true);
  });

  it("findContrastIssues は問題のあるテーマだけ返す", () => {
    const bad: Theme = {
      ...sample, id: "bad",
      modes: { ...sample.modes, light: { ...sample.modes.light, fg: "#fefefe" } },
    };
    const issues = findContrastIssues([sample, bad]);
    expect(issues.every((i) => i.themeId === "bad")).toBe(true);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("**組み込みテーマはすべて AA を満たす**(11 スキン × 2 モードは目視では見落とす)", () => {
    expect(findContrastIssues(builtInThemes)).toEqual([]);
  });
});

describe("deriveTheme(主色からスキンを自動生成)", () => {
  it("light / dark 両方のトークンを揃える", () => {
    const t = deriveTheme({ id: "brand", name: "自社色", primary: "#0057b8" });
    expect(t.id).toBe("brand");
    expect(Object.keys(t.modes).sort()).toEqual(["dark", "light"]);
    expect(t.modes.light.primary).toBeTruthy();
    expect(t.modes.dark.primary).toBeTruthy();
  });

  it("**生成したスキンは AA を満たす**(自動生成でも読めない配色を作らない)", () => {
    for (const primary of ["#0057b8", "#d32f2f", "#2e7d32", "#f9a825"]) {
      const t = deriveTheme({ id: "x", name: "x", primary });
      expect(findContrastIssues([t])).toEqual([]);
    }
  });

  it("base で下地の色味を変えられる", () => {
    const light = deriveTheme({ id: "a", name: "a", primary: "#0057b8", base: "light" });
    const warm = deriveTheme({ id: "b", name: "b", primary: "#0057b8", base: "warm" });
    expect(light.modes.light.bg).not.toBe(warm.modes.light.bg);
  });

  it("shape を部分的に上書きできる", () => {
    const t = deriveTheme({ id: "a", name: "a", primary: "#0057b8", shape: { radius: 16 } });
    expect(t.shape.radius).toBe(16);
    expect(t.shape.fontFamily).toBeTruthy(); // 指定しなかった項目は既定が入る
  });
});

describe("検証と入出力", () => {
  it("妥当なテーマは問題なし", () => {
    expect(validateTheme(sample)).toEqual([]);
  });

  it("必須項目が欠けていれば指摘する", () => {
    expect(validateTheme({ id: "x" }).length).toBeGreaterThan(0);
    expect(validateTheme(null).length).toBeGreaterThan(0);
    expect(validateTheme("theme").length).toBeGreaterThan(0);
  });

  it("不正な id を指摘する", () => {
    const issues = validateTheme({ ...sample, id: "bad id" });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("parseTheme は妥当なら返し、不正なら投げる", () => {
    expect(parseTheme(sample).id).toBe("sample");
    let threw = false;
    try { parseTheme({ id: "x" }); } catch { threw = true; }
    expect(threw).toBe(true);
  });

  it("JSON へ出して読み戻すと同じになる(往復できる)", () => {
    expect(parseTheme(JSON.parse(themeToJson(sample)))).toEqual(sample);
  });

  it("複数テーマも往復できる", () => {
    const restored = themesFromJson(themesToJson([sample, defaultTheme]));
    expect(restored.map((t) => t.id)).toEqual([sample.id, defaultTheme.id]);
  });

  it("壊れた JSON は例外にする(黙って空を返さない)", () => {
    let threw = false;
    try { themesFromJson("{ これは JSON ではない"); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});

describe("組み込みテーマ", () => {
  it("id が重複しない", () => {
    const ids = builtInThemes.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("id はすべて妥当(セレクタに入れても壊れない)", () => {
    expect(builtInThemes.every((t) => isValidThemeId(t.id))).toBe(true);
  });

  it("すべてが light / dark 両方を持つ", () => {
    expect(builtInThemes.every((t) => t.modes.light && t.modes.dark)).toBe(true);
  });

  it("すべてが検証を通る", () => {
    for (const t of builtInThemes) expect(validateTheme(t)).toEqual([]);
  });
});
