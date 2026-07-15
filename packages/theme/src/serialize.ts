/**
 * テーマの検証とシリアライズ。DB 保存・JSON 入出力の前後で使う。
 * 外部から来た JSON をそのまま Theme として信用しないためのゲート。
 * @packageDocumentation
 */
import { AppError, ErrorCode } from "@platform/core";
import type { Theme, ThemeTokens } from "./tokens.js";
import { isValidThemeId } from "./tokens.js";

/** ThemeTokens の必須キー。 */
const TOKEN_KEYS: (keyof ThemeTokens)[] = ["bg", "fg", "muted", "surface", "border", "primary", "primaryFg", "accent", "success", "warning", "danger"];

/** CSS 色として許容する形（hex / rgb() / hsl() / 既知のキーワード）。 */
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/deg]+\)|[a-zA-Z]+)$/;

function isColor(v: unknown): v is string {
  return typeof v === "string" && v.length <= 64 && COLOR_RE.test(v.trim());
}

/** 検証の失敗理由。 */
export interface ThemeValidationIssue {
  path: string;
  message: string;
}

/**
 * 未知の値が Theme として妥当か検証し、問題の一覧を返す（空なら妥当）。
 * 例外は投げない。投げてほしい場合は {@link parseTheme} を使う。
 */
export function validateTheme(value: unknown): ThemeValidationIssue[] {
  const issues: ThemeValidationIssue[] = [];
  if (typeof value !== "object" || value === null) {
    return [{ path: "", message: "オブジェクトではありません" }];
  }
  const t = value as Partial<Theme>;

  if (typeof t.id !== "string" || !isValidThemeId(t.id)) issues.push({ path: "id", message: "id が不正です（英数字・ハイフンのみ、1〜40 文字）" });
  if (typeof t.name !== "string" || !t.name.trim()) issues.push({ path: "name", message: "name が空です" });
  if (t.description !== undefined && typeof t.description !== "string") issues.push({ path: "description", message: "description は文字列です" });

  const shape = t.shape as Partial<Theme["shape"]> | undefined;
  if (!shape || typeof shape !== "object") {
    issues.push({ path: "shape", message: "shape がありません" });
  } else {
    if (typeof shape.fontFamily !== "string" || !shape.fontFamily.trim()) issues.push({ path: "shape.fontFamily", message: "fontFamily が空です" });
    if (typeof shape.radius !== "number" || shape.radius < 0 || shape.radius > 100) issues.push({ path: "shape.radius", message: "radius は 0〜100 の数値です" });
    if (typeof shape.spacing !== "number" || shape.spacing < 0 || shape.spacing > 100) issues.push({ path: "shape.spacing", message: "spacing は 0〜100 の数値です" });
    if (![0, 1, 2, 3].includes(shape.elevation as number)) issues.push({ path: "shape.elevation", message: "elevation は 0〜3 です" });
  }

  const modes = t.modes as Partial<Theme["modes"]> | undefined;
  if (!modes || typeof modes !== "object") {
    issues.push({ path: "modes", message: "modes がありません" });
  } else {
    for (const mode of ["light", "dark"] as const) {
      const tokens = modes[mode] as Partial<ThemeTokens> | undefined;
      if (!tokens || typeof tokens !== "object") {
        issues.push({ path: `modes.${mode}`, message: `${mode} モードがありません` });
        continue;
      }
      for (const key of TOKEN_KEYS) {
        if (!isColor(tokens[key])) issues.push({ path: `modes.${mode}.${key}`, message: `${key} が色として不正です` });
      }
    }
  }
  return issues;
}

/** 妥当なら Theme として返し、不正なら VALIDATION エラーを投げる。 */
export function parseTheme(value: unknown): Theme {
  const issues = validateTheme(value);
  if (issues.length > 0) {
    const detail = issues.slice(0, 3).map((i) => `${i.path || "(root)"}: ${i.message}`).join(" / ");
    throw new AppError(ErrorCode.VALIDATION, `テーマの形式が不正です — ${detail}${issues.length > 3 ? ` ほか ${issues.length - 3} 件` : ""}`);
  }
  return value as Theme;
}

/** テーマを JSON 文字列にする（保存・書き出し用・整形済み）。 */
export function themeToJson(theme: Theme): string {
  return JSON.stringify(theme, null, 2);
}

/** 複数テーマを JSON にする（書き出し用）。 */
export function themesToJson(themes: Theme[]): string {
  return JSON.stringify({ version: 1, themes }, null, 2);
}

/**
 * JSON 文字列からテーマを読み込む（単体 or `{version, themes}` の束の両方に対応）。
 * 不正なテーマは VALIDATION エラー。読み込めたテーマの配列を返す。
 */
export function themesFromJson(json: string): Theme[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new AppError(ErrorCode.VALIDATION, "JSON として読み取れません");
  }
  if (Array.isArray(parsed)) return parsed.map(parseTheme);
  if (typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { themes?: unknown }).themes)) {
    return ((parsed as { themes: unknown[] }).themes).map(parseTheme);
  }
  return [parseTheme(parsed)];
}
