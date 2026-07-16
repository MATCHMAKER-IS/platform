/**
 * ログイン監査イベントの標準化。ログイン/ログアウト/失敗/ロック/再認証などを
 * 共通スキーマで記録する。出力先(DB/ログ/SIEM)は sink として注入する。
 * @packageDocumentation
 */

/** 監査イベント種別。 */
export type LoginEventType =
  | "login_success" | "login_failure" | "logout"
  | "account_locked" | "session_expired" | "idle_logout"
  | "step_up_success" | "step_up_failure" | "password_changed" | "all_sessions_revoked";

/** 監査イベント(共通スキーマ)。 */
export interface LoginAuditEvent {
  event: LoginEventType;
  /** 対象ユーザー(メール/ID)。 */
  subject?: string;
  /** クライアント IP。 */
  ip?: string;
  /** User-Agent。 */
  userAgent?: string;
  /** 認証方式(password/oidc/apikey 等)。 */
  method?: string;
  /** 失敗理由・補足。 */
  reason?: string;
  /** 発生時刻(ISO 8601)。 */
  at: string;
  /** 追加メタ情報。 */
  metadata?: Record<string, unknown>;
}

/** 監査イベントの出力先。 */
export interface LoginAuditSink {
  record(event: LoginAuditEvent): void | Promise<void>;
}

/**
 * ログイン監査のロガーを作る。
 *
 * **「誰が・いつ・どこから・成功したか失敗したか」を残す**。不正アクセスの調査に必要。
 *
 * @param sink 実際の書き込み先(DB・ログ基盤など)
 * @param options.now 時刻の取得(テスト注入用)
 * @returns ロガー
 */
export function createLoginAudit(sink: LoginAuditSink, options?: { now?: () => Date }) {
  const now = options?.now ?? (() => new Date());
  async function emit(event: LoginEventType, fields: Omit<LoginAuditEvent, "event" | "at"> = {}): Promise<void> {
    await sink.record({ event, at: now().toISOString(), ...fields });
  }
  return {
    loginSuccess: (f?: Omit<LoginAuditEvent, "event" | "at">) => emit("login_success", f),
    loginFailure: (f?: Omit<LoginAuditEvent, "event" | "at">) => emit("login_failure", f),
    logout: (f?: Omit<LoginAuditEvent, "event" | "at">) => emit("logout", f),
    accountLocked: (f?: Omit<LoginAuditEvent, "event" | "at">) => emit("account_locked", f),
    idleLogout: (f?: Omit<LoginAuditEvent, "event" | "at">) => emit("idle_logout", f),
    stepUpSuccess: (f?: Omit<LoginAuditEvent, "event" | "at">) => emit("step_up_success", f),
    stepUpFailure: (f?: Omit<LoginAuditEvent, "event" | "at">) => emit("step_up_failure", f),
    allSessionsRevoked: (f?: Omit<LoginAuditEvent, "event" | "at">) => emit("all_sessions_revoked", f),
    /** 任意イベントを直接記録する。 */
    emit,
  };
}

/**
 * 監査イベントから、**機微情報を落とした**要約行を作る。
 *
 * **パスワードやトークンをログに残さない**ため。ログは広く読まれるので、
 * ここで落としておかないと漏洩経路になる。
 *
 * @param event 監査イベント
 * @returns 表示用の要約(1 行)
 */
export function summarizeLoginEvent(e: LoginAuditEvent): string {
  const who = e.subject ?? "(unknown)";
  const from = e.ip ? ` from ${e.ip}` : "";
  const why = e.reason ? ` (${e.reason})` : "";
  return `[${e.at}] ${e.event}: ${who}${from}${why}`;
}
