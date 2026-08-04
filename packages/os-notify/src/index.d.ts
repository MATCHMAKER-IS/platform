/**
 * OS ネイティブのデスクトップ通知・音を鳴らす(Windows / macOS / Linux)。
 *
 * 既存の @platform/notify は Slack / メール / SMS など「外部サービスへの通知」を扱うが、
 * ここは「実行中のマシン自身」に通知・音を出す用途(常駐ツール・RPA・バッチの完了通知など)。
 *
 * ## 設計
 * OS ごとにコマンド(と引数)を生成する純関数 {@link buildNotifyCommand} /
 * {@link buildSoundCommand} を中心に据え、実際のプロセス起動は spawn を注入する。
 * これにより「どの OS でどんなコマンドを組み立てるか」を child_process 無しで単体テストできる。
 *
 * - Windows: PowerShell の BurntToast 不要版(Windows.UI.Notifications / msg)+ [console]::Beep
 * - macOS: osascript(display notification)+ afplay / say
 * - Linux: notify-send + paplay / aplay
 *
 * 依存ゼロ(core のみ)。実行時に child_process.spawn 相当を渡す。
 * @packageDocumentation
 */
import { type Result } from "@platform/core";
/** 対応 OS。 */
export type OsPlatform = "win32" | "darwin" | "linux";
/** 生成されたコマンド(コマンド名 + 引数)。spawn にそのまま渡せる形。 */
export interface OsCommand {
    command: string;
    args: string[];
}
/** 通知の内容。 */
export interface OsNotification {
    title: string;
    message: string;
    /** 通知に添える音(true でシステム既定音)。 */
    sound?: boolean;
}
/**
 * デスクトップ通知を出すコマンドを OS 別に生成する(純関数)。
 * @param platform process.platform 相当
 * @returns OS ごとの通知コマンド(**macOS は osascript、Windows は PowerShell、Linux は notify-send**)
 */
export declare function buildNotifyCommand(platform: OsPlatform, n: OsNotification): OsCommand;
/**
 * 音を鳴らすコマンドを OS 別に生成する(純関数)。
 * soundFile 未指定ならシステム既定音(ビープ等)。
 *
 * @param sound 音の種類
 * @returns OS ごとの再生コマンド
 */
export declare function buildSoundCommand(platform: OsPlatform, soundFile?: string): OsCommand;
/** spawn の最小インターフェース(child_process.spawn 互換・テスト差し替え用)。 */
export type SpawnLike = (command: string, args: string[], options?: {
    detached?: boolean;
    stdio?: string;
}) => {
    on(event: "error" | "close", cb: (arg: unknown) => void): void;
    unref?: () => void;
};
/** 通知履歴の1件。 */
export interface OsNotifyLogEntry {
    at: number;
    kind: "notify" | "sound";
    title?: string;
    message?: string;
    platform: OsPlatform;
    ok: boolean;
    error?: string;
}
/** 通知履歴ストア(注入式・メモリ/DB を差し替え可能)。 */
export interface OsNotifyLogStore {
    append(entry: OsNotifyLogEntry): void;
    list(limit?: number): OsNotifyLogEntry[];
}
/**
 * 通知履歴ストアのメモリ実装。
 *
 * **最大件数を超えたら古いものから捨てる**(通知履歴は無限に増えるため)。
 * 本番で長期保存したいなら DB 実装を使う。
 *
 * @param options.capacity 保持する件数
 * @returns 履歴ストア
 */
export declare function createMemoryNotifyLog(options?: {
    max?: number;
}): OsNotifyLogStore;
/** OS 通知ランナーの設定。 */
export interface OsNotifierOptions {
    /** process.platform。省略時は "linux" 扱い(明示推奨)。 */
    platform?: OsPlatform;
    /** child_process.spawn 相当。省略時は「コマンドを組み立てるだけで実行しない」dry-run。 */
    spawn?: SpawnLike;
    /** 通知履歴ストア(渡すと notify/playSound が記録される)。 */
    log?: OsNotifyLogStore;
    /** 時刻取得(テスト用)。既定 Date.now。 */
    now?: () => number;
}
/** OS 通知ランナー。 */
export interface OsNotifier {
    /** デスクトップ通知を出す。dry-run 時は生成コマンドを返すのみ。 */
    notify(n: OsNotification): Promise<Result<OsCommand>>;
    /** 音を鳴らす。 */
    playSound(soundFile?: string): Promise<Result<OsCommand>>;
    /** 現在の OS。 */
    readonly platform: OsPlatform;
}
export declare function createOsNotifier(options?: OsNotifierOptions): OsNotifier;
//# sourceMappingURL=index.d.ts.map