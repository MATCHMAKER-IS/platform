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
 *
 * @param authAt 最後に認証した時刻(epoch ミリ秒)。**未設定なら再認証が必要**
 * @param maxAgeMs この時間を過ぎたら再認証を求める
 * @param now 現在時刻(テスト注入用)
 * @returns true なら再認証を要求すべき
 */
export function stepUpRequired(authAt: number | undefined, config: StepUpConfig): boolean {
  const now = (config.now ?? (() => Date.now()))();
  if (typeof authAt !== "number") return true; // 認証時刻が無ければ要再認証
  return now - authAt > config.freshnessSec * 1000;
}

/**
 * 再認証に成功した時刻を返す(セッションへ書き戻す用)。
 *
 * @param now 現在時刻(テスト注入用)
 * @returns 認証時刻(epoch ミリ秒)
 */
export function markAuthenticated(now: () => number = () => Date.now()): number {
  return now();
}

/**
 * step-up 認証(重要操作の前の再認証)のヘルパーを作る。
 *
 * **ログインから時間が経っていたら、もう一度パスワードを求める**仕組み。
 * 席を離れた隙に他人が操作する事故を防ぐ。金額の変更・権限の付与など、
 * 取り返しのつかない操作の前に使う。
 *
 * セッションデータに `authAt`(最後に認証した時刻)を持たせて使う。
 *
 * @param options.maxAgeMs この時間を過ぎたら再認証を求める
 * @param options.now 時刻の取得(テスト注入用)
 * @returns ヘルパー。`needsStepUp` で判定する
 */
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
 *
 * **「ログイン状態を保持する」を選んだ人だけ長くする**。共用 PC で誤って選ばれると
 * 危険なので、既定は短い方。
 *
 * @param remember ログイン状態を保持するか
 * @param options.rememberSec 保持する場合の期間(既定 30 日)
 * @param options.defaultSec 通常の期間(既定 1 日)
 * @returns 有効期間(秒)
 * ログインフォームの「ログイン状態を保持する」チェックに使う。
 */
export function sessionMaxAge(remember: boolean, config: RememberMeConfig): number {
  return remember ? config.rememberMaxAgeSec : config.defaultMaxAgeSec;
}
