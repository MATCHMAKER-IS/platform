/**
 * 重要操作前の再認証(step-up)と Remember-me(記憶ログイン)の補助。
 * どちらも「セッションにいつ認証したか(authAt)を記録し、鮮度を判定する」考え方。
 * @packageDocumentation
 */

/** step-up の設定。 */
export interface StepUpConfig {
  /** 再認証が有効とみなす鮮度(秒)。例: 300 = 直近5分の認証なら再認証不要。 */
  freshnessSec: number;
  now?: () => number;
}

/**
 * 直近の認証時刻(authAt: epoch ms)から、重要操作に再認証が必要かを判定する。
 * @returns true なら再認証を要求すべき
 */
export function stepUpRequired(authAt: number | undefined, config: StepUpConfig): boolean {
  const now = (config.now ?? (() => Date.now()))();
  if (typeof authAt !== "number") return true; // 認証時刻が無ければ要再認証
  return now - authAt > config.freshnessSec * 1000;
}

/** 再認証成功後にセッションへ書き戻す認証時刻を返す。 */
export function markAuthenticated(now: () => number = () => Date.now()): number {
  return now();
}

/** step-up ヘルパー。セッションデータに authAt を持たせて使う。 */
export function createStepUp(config: StepUpConfig) {
  return {
    /** 再認証が必要か。 */
    required(authAt: number | undefined): boolean {
      return stepUpRequired(authAt, config);
    },
    /** 再認証済みの印(authAt)。セッション更新時に保存する。 */
    stamp(): number {
      return markAuthenticated(config.now);
    },
  };
}

// ─────────────────────────── Remember-me ───────────────────────────

/** Remember-me の設定。 */
export interface RememberMeConfig {
  /** 通常(ブラウザを閉じたら/短時間で切れる)の有効期間(秒)。 */
  defaultMaxAgeSec: number;
  /** 「ログイン状態を保持」選択時の有効期間(秒。例: 30日)。 */
  rememberMaxAgeSec: number;
}

/**
 * Remember-me の選択に応じてセッション有効期間(秒)を返す。
 * ログインフォームの「ログイン状態を保持する」チェックに使う。
 */
export function sessionMaxAge(remember: boolean, config: RememberMeConfig): number {
  return remember ? config.rememberMaxAgeSec : config.defaultMaxAgeSec;
}
