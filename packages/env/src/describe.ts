/**
 * 環境変数の周辺ユーティリティ。parseEnv(検証)を補い、実運用で必要になる
 * 「説明の生成」「秘密値のマスキング」「.env.example の生成」を提供する。
 * @packageDocumentation
 */
import { z } from "zod";
import { AppError, ErrorCode } from "@platform/core";

/** 環境変数 1 件の説明。 */
export interface EnvVarInfo {
  /** 変数名。 */
  name: string;
  /** 必須か(既定値が無く optional でもない)。 */
  required: boolean;
  /** 既定値(あれば)。 */
  defaultValue?: string;
  /** 説明(zod の .describe() から)。 */
  description?: string;
  /** 想定される型・許容値の説明(例: "文字列(URL)"、"debug | info | warn")。 */
  type: string;
  /** 秘密値とみなすか(名前に KEY/SECRET/TOKEN/PASSWORD を含む)。 */
  secret: boolean;
}

/** 名前から秘密値らしさを判定する。 */
export function isSecretName(name: string): boolean {
  return /(_KEY|_SECRET|_TOKEN|_PASSWORD|^SECRET|PASSWORD$|APIKEY|API_KEY)/i.test(name);
}

/** zod の型から人が読める型説明を作る。 */
function describeType(schema: z.ZodTypeAny): string {
  const def = schema._def as { typeName?: string; values?: unknown[]; innerType?: z.ZodTypeAny; checks?: { kind: string }[] };
  const typeName = def.typeName;
  if (typeName === "ZodDefault" || typeName === "ZodOptional" || typeName === "ZodNullable") {
    return def.innerType ? describeType(def.innerType) : "不明";
  }
  if (typeName === "ZodEnum") return (def.values ?? []).join(" | ");
  if (typeName === "ZodNumber") return "数値";
  if (typeName === "ZodBoolean") return "真偽値";
  if (typeName === "ZodString") {
    const kinds = (def.checks ?? []).map((c) => c.kind);
    if (kinds.includes("url")) return "文字列(URL)";
    if (kinds.includes("email")) return "文字列(メールアドレス)";
    return "文字列";
  }
  return typeName ? typeName.replace(/^Zod/, "").toLowerCase() : "不明";
}

/** zod スキーマから既定値を取り出す(無ければ undefined)。 */
function extractDefault(schema: z.ZodTypeAny): string | undefined {
  const def = schema._def as { typeName?: string; defaultValue?: () => unknown; innerType?: z.ZodTypeAny };
  if (def.typeName === "ZodDefault" && typeof def.defaultValue === "function") {
    const v = def.defaultValue();
    return v === undefined ? undefined : String(v);
  }
  if (def.innerType) return extractDefault(def.innerType);
  return undefined;
}

/** optional か(ZodOptional/ZodDefault なら必須ではない)。 */
function isOptional(schema: z.ZodTypeAny): boolean {
  const def = schema._def as { typeName?: string; innerType?: z.ZodTypeAny };
  if (def.typeName === "ZodOptional" || def.typeName === "ZodDefault") return true;
  return false;
}

/**
 * zod の object スキーマから、環境変数の一覧と説明を作る。
 * ドキュメント生成・.env.example 生成・管理画面での表示に使う。
 *
 * @example
 * ```ts
 * const schema = z.object({ DATABASE_URL: z.string().url().describe("接続先 DB") });
 * describeEnv(schema); // => [{ name: "DATABASE_URL", required: true, type: "文字列(URL)", ... }]
 * ```
 */
export function describeEnv(schema: z.ZodObject<z.ZodRawShape>): EnvVarInfo[] {
  const shape = schema.shape;
  const infos: EnvVarInfo[] = [];
  for (const name of Object.keys(shape)) {
    const field = shape[name] as z.ZodTypeAny | undefined;
    if (!field) continue;
    const defaultValue = extractDefault(field);
    const description = (field._def as { description?: string }).description;
    infos.push({
      name,
      required: !isOptional(field),
      ...(defaultValue !== undefined ? { defaultValue } : {}),
      ...(description ? { description } : {}),
      type: describeType(field),
      secret: isSecretName(name),
    });
  }
  return infos.sort((a, b) => (a.required === b.required ? a.name.localeCompare(b.name) : a.required ? -1 : 1));
}

/**
 * 環境変数の値をログに出せる形にマスクする。秘密値は `***` にする。
 * 障害調査で「今の設定」を出したいが、鍵は出したくない場面で使う。
 */
export function maskSecrets(values: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === null) { out[k] = ""; continue; }
    out[k] = isSecretName(k) ? "***" : String(v);
  }
  return out;
}

/**
 * スキーマから .env.example の中身を生成する。必須・任意でセクション分けし、
 * 説明・型・既定値をコメントで添える。秘密値は空にしておく(値を書かない)。
 */
export function renderEnvExample(schema: z.ZodObject<z.ZodRawShape>, options: { header?: string } = {}): string {
  const infos = describeEnv(schema);
  const lines: string[] = [];
  if (options.header) lines.push(...options.header.split("\n").map((l) => (l.startsWith("#") ? l : `# ${l}`)), "");

  const render = (info: EnvVarInfo): string[] => {
    const out: string[] = [];
    const notes = [info.type, info.description].filter(Boolean).join(" — ");
    if (notes) out.push(`# ${notes}`);
    if (info.secret) out.push(`${info.name}=`);
    else out.push(`${info.name}=${info.defaultValue ?? ""}`);
    return out;
  };

  const required = infos.filter((i) => i.required);
  const optional = infos.filter((i) => !i.required);
  if (required.length > 0) {
    lines.push("# --- 必須 ---");
    for (const i of required) lines.push(...render(i), "");
  }
  if (optional.length > 0) {
    lines.push("# --- 任意(既定値あり) ---");
    for (const i of optional) lines.push(...render(i), "");
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * 必須の秘密値(SESSION_SECRET など)を検証付きで読む。
 * `process.env` を各所で直接読むのを避けるための入口。欠けていれば CONFIG エラー。
 *
 * @param names 必須の環境変数名
 * @param source 読み取り元(既定 process.env)
 * @returns 名前→値のマップ(すべて非空文字列)
 * @throws {@link @platform/core#AppError} コード `CONFIG` — 欠けている変数がある場合
 */
export function requireEnv<K extends string>(
  names: readonly K[],
  source: Record<string, string | undefined> = process.env,
): Record<K, string> {
  const out = {} as Record<K, string>;
  const missing: string[] = [];
  for (const name of names) {
    const v = source[name];
    if (v === undefined || v === "") missing.push(name);
    else out[name] = v;
  }
  if (missing.length > 0) {
    throw new AppError(ErrorCode.CONFIG, `必須の環境変数が設定されていません: ${missing.join(", ")}`, {
      details: { missing },
    });
  }
  return out;
}

/**
 * 任意の環境変数を読む(既定値付き)。requireEnv と対になる読み取り口。
 */
export function optionalEnv(
  name: string,
  fallback = "",
  source: Record<string, string | undefined> = process.env,
): string {
  const v = source[name];
  return v === undefined || v === "" ? fallback : v;
}

/** 秘密値の強度に関する問題。 */
export interface SecretIssue {
  /** 変数名。 */
  name: string;
  /** 深刻度。error は本番で起動を止める想定。 */
  level: "error" | "warn";
  /** 何が問題か。 */
  message: string;
}

/** 開発用の既定値としてよく使われる値(本番では危険)。 */
const WEAK_PATTERNS = [
  /change[-_]?me/i,
  /^dev[-_]/i,
  /^test$/i,
  /^secret$/i,
  /^password$/i,
  /^admin\d*$/i,
  /^changeit$/i,
  /^please[-_]?change/i,
];

/**
 * 秘密値の強度を検査する。本番で「開発用の既定値のまま」「短すぎる」ものを検出する。
 *
 * - 12 文字未満: error(総当たりに耐えない)
 * - 開発用の既定値らしい(change-me / dev- で始まる 等): error
 * - 16 文字未満: warn(推奨は 32 文字以上)
 * - 文字種が 1 種類のみ(すべて数字 等): warn
 *
 * @param values 検査する値(名前→値)。秘密値でない名前は無視する
 * @returns 問題の一覧(空なら良好)
 *
 * @example
 * ```ts
 * const issues = checkSecretStrength({ SESSION_SECRET: "dev-secret-change-me" });
 * // => [{ name: "SESSION_SECRET", level: "error", message: "開発用の既定値のようです…" }]
 * ```
 */
export function checkSecretStrength(values: Record<string, string | undefined>): SecretIssue[] {
  const issues: SecretIssue[] = [];
  for (const [name, value] of Object.entries(values)) {
    if (!isSecretName(name)) continue;
    if (value === undefined || value === "") continue; // 未設定は requireEnv の担当
    if (WEAK_PATTERNS.some((re) => re.test(value))) {
      issues.push({ name, level: "error", message: "開発用の既定値のようです。本番では必ず変更してください" });
      continue;
    }
    if (value.length < 12) {
      issues.push({ name, level: "error", message: `短すぎます(${value.length} 文字)。32 文字以上を推奨します` });
      continue;
    }
    if (value.length < 16) {
      issues.push({ name, level: "warn", message: `やや短いです(${value.length} 文字)。32 文字以上を推奨します` });
    }
    const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((re) => re.test(value)).length;
    if (kinds <= 1) {
      issues.push({ name, level: "warn", message: "文字種が単調です(英大小・数字・記号を混ぜてください)" });
    }
  }
  return issues;
}

/**
 * 本番で秘密値の強度を検査し、error があれば起動を止める(fail-fast)。
 * 本番以外では warn として stderr に出すだけで止めない。
 *
 * @param values 検査する値
 * @param options.isProduction 本番か(既定: NODE_ENV === "production")
 * @param options.onWarn 警告の出力先(既定: console.warn)
 * @throws {@link @platform/core#AppError} コード `CONFIG` — 本番で error 級の問題がある場合
 */
export function assertSecretStrength(
  values: Record<string, string | undefined>,
  options: { isProduction?: boolean; onWarn?: (message: string) => void } = {},
): SecretIssue[] {
  const isProd = options.isProduction ?? process.env.NODE_ENV === "production";
  const onWarn = options.onWarn ?? ((m: string) => console.warn(m));
  const issues = checkSecretStrength(values);
  if (issues.length === 0) return issues;

  const errors = issues.filter((i) => i.level === "error");
  if (isProd && errors.length > 0) {
    const detail = errors.map((i) => `${i.name}: ${i.message}`).join(" / ");
    throw new AppError(ErrorCode.CONFIG, `秘密値の強度が不十分です — ${detail}`, {
      details: { issues: errors },
    });
  }
  for (const i of issues) {
    onWarn(`[env] ${i.level === "error" ? "危険" : "注意"}: ${i.name} — ${i.message}`);
  }
  return issues;
}
