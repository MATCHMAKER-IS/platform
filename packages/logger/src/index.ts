/**
 * `@platform/logger` — 構造化ログの共通部品。
 *
 * `console.log` の直接使用を禁止し、JSON 構造化ログに統一する。
 * 既定で機微情報(パスワード・トークン・メール・電話など)をマスキングし、
 * 業務データの漏洩を防ぐ。内部実装は pino だが、アプリからは公開 API 経由で使う。
 *
 * @packageDocumentation
 */

import pino, { type Logger as PinoLogger } from "pino";

/** ログレベル。深刻度の低い順。 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/** 基盤が公開するロガーの型(pino の実体を隠蔽した最小インターフェース)。 */
export interface Logger {
  /** 子ロガーを作る。共通フィールド(requestId 等)を束ねるのに使う。 */
  child(bindings: Record<string, unknown>): Logger;
  trace(obj: unknown, msg?: string): void;
  debug(obj: unknown, msg?: string): void;
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  fatal(obj: unknown, msg?: string): void;
}

/** 既定でマスキングするフィールドのパス。各アプリで追加も可能。 */
export const DEFAULT_REDACT_PATHS = [
  "password",
  "*.password",
  "token",
  "*.token",
  "accessToken",
  "*.accessToken",
  "authorization",
  "*.authorization",
  "email",
  "*.email",
  "phone",
  "*.phone",
];

/** {@link createLogger} のオプション。 */
export interface LoggerOptions {
  /** 出力する最低レベル(既定: "info")。 */
  level?: LogLevel;
  /** 全ログに付与する固定フィールド(例: `{ service: "internal-app" }`)。 */
  base?: Record<string, unknown>;
  /** 開発時に人間可読な整形出力にするか(既定: false = JSON)。 */
  pretty?: boolean;
  /** マスキング対象を追加するパス(DEFAULT_REDACT_PATHS に追記される)。 */
  redact?: string[];
  /**
   * 各ログ出力時に呼ばれ、返したフィールドを全ログにマージする。
   * 相関ID(traceId 等)の自動付与に使う({@link createContextStore} の `provider`)。
   */
  contextProvider?: () => Record<string, unknown>;
}

function wrap(p: PinoLogger, contextProvider?: () => Record<string, unknown>): Logger {
  // obj に相関コンテキストをマージ(明示フィールドが優先)。
  const merge = (obj: unknown): object => {
    if (!contextProvider) return obj as object;
    const ctx = contextProvider();
    if (!ctx || Object.keys(ctx).length === 0) return (obj ?? {}) as object;
    if (obj !== null && typeof obj === "object") return { ...ctx, ...(obj as object) };
    return { ...ctx, msg: obj };
  };
  return {
    child: (bindings) => wrap(p.child(bindings), contextProvider),
    trace: (obj, msg) => p.trace(merge(obj), msg),
    debug: (obj, msg) => p.debug(merge(obj), msg),
    info: (obj, msg) => p.info(merge(obj), msg),
    warn: (obj, msg) => p.warn(merge(obj), msg),
    error: (obj, msg) => p.error(merge(obj), msg),
    fatal: (obj, msg) => p.fatal(merge(obj), msg),
  };
}

/**
 * 構造化ロガーを生成する。既定で機微情報をマスキングする。
 *
 * @param options 出力レベル・固定フィールド・整形・追加マスキング
 * @returns 基盤共通の {@link Logger}
 *
 * @example
 * ```ts
 * const log = createLogger({ base: { service: "internal-app" } });
 * log.info({ userId: 1, email: "a@b.c" }, "ログイン");
 * // email は [Redacted] にマスクされて出力される
 * ```
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const { level = "info", base, pretty = false, redact = [], contextProvider } = options;
  return wrap(
    pino({
      level,
      base: base ?? undefined,
      redact: { paths: [...DEFAULT_REDACT_PATHS, ...redact], censor: "[Redacted]" },
      ...(pretty ? { transport: { target: "pino-pretty" } } : {}),
    }),
    contextProvider,
  );
}

export { createContextStore, type ContextStore, type LogContext } from "./context.js";
