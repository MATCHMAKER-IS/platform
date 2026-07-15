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
import { AppError, ErrorCode, ok, err, type Result } from "@platform/core";

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

function psEscape(s: string): string {
  // PowerShell シングルクォート内は '' でエスケープ
  return s.replace(/'/g, "''");
}

function shEscape(s: string): string {
  // osascript / シェル用のダブルクォート内エスケープ
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * デスクトップ通知を出すコマンドを OS 別に生成する(純関数)。
 * @param platform process.platform 相当
 */
export function buildNotifyCommand(platform: OsPlatform, n: OsNotification): OsCommand {
  const title = n.title;
  const message = n.message;
  if (platform === "win32") {
    // PowerShell のトースト通知(標準 API・追加モジュール不要)。失敗時もエラーにしない。
    const script =
      `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; ` +
      `$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); ` +
      `$x = $t.GetElementsByTagName('text'); ` +
      `$x.Item(0).AppendChild($t.CreateTextNode('${psEscape(title)}')) > $null; ` +
      `$x.Item(1).AppendChild($t.CreateTextNode('${psEscape(message)}')) > $null; ` +
      `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Platform').Show([Windows.UI.Notifications.ToastNotification]::new($t))`;
    return { command: "powershell", args: ["-NoProfile", "-Command", script] };
  }
  if (platform === "darwin") {
    const soundClause = n.sound ? ` sound name "Ping"` : "";
    return { command: "osascript", args: ["-e", `display notification "${shEscape(message)}" with title "${shEscape(title)}"${soundClause}`] };
  }
  // linux
  return { command: "notify-send", args: [title, message] };
}

/**
 * 音を鳴らすコマンドを OS 別に生成する(純関数)。
 * soundFile 未指定ならシステム既定音(ビープ等)。
 */
export function buildSoundCommand(platform: OsPlatform, soundFile?: string): OsCommand {
  if (platform === "win32") {
    if (soundFile) {
      return { command: "powershell", args: ["-NoProfile", "-Command", `(New-Object Media.SoundPlayer '${psEscape(soundFile)}').PlaySync()`] };
    }
    return { command: "powershell", args: ["-NoProfile", "-Command", "[console]::Beep(880,300)"] };
  }
  if (platform === "darwin") {
    return { command: "afplay", args: [soundFile ?? "/System/Library/Sounds/Ping.aiff"] };
  }
  // linux: paplay(PulseAudio)。ファイル未指定時は端末ベル。
  if (soundFile) return { command: "paplay", args: [soundFile] };
  return { command: "sh", args: ["-c", "printf '\\a'"] };
}

/** spawn の最小インターフェース(child_process.spawn 互換・テスト差し替え用)。 */
export type SpawnLike = (command: string, args: string[], options?: { detached?: boolean; stdio?: string }) => { on(event: "error" | "close", cb: (arg: unknown) => void): void; unref?: () => void };

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

/** メモリ実装の通知履歴ストア(最大件数を超えたら古いものを捨てる)。 */
export function createMemoryNotifyLog(options: { max?: number } = {}): OsNotifyLogStore {
  const max = options.max ?? 200;
  const entries: OsNotifyLogEntry[] = [];
  return {
    append(entry) { entries.push(entry); if (entries.length > max) entries.shift(); },
    list(limit = 50) { return entries.slice(-limit).reverse(); },
  };
}

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

/**
 * OS 通知ランナーを作る。spawn を渡すと実際に通知/音を出し、渡さなければコマンド生成のみ(dry-run)。
 * @example
 * ```ts
 * import { spawn } from "node:child_process";
 * const notifier = createOsNotifier({ platform: process.platform as OsPlatform, spawn });
 * await notifier.notify({ title: "完了", message: "バッチが終わりました", sound: true });
 * ```
 */
export function createOsNotifier(options: OsNotifierOptions = {}): OsNotifier {
  const platform = options.platform ?? "linux";
  const spawn = options.spawn;
  const log = options.log;
  const now = options.now ?? (() => Date.now());

  async function runCommand(cmd: OsCommand): Promise<Result<OsCommand>> {
    if (!spawn) return ok(cmd); // dry-run
    return new Promise<Result<OsCommand>>((resolve) => {
      try {
        const child = spawn(cmd.command, cmd.args, { detached: true, stdio: "ignore" });
        let settled = false;
        child.on("error", (e) => {
          if (settled) return;
          settled = true;
          resolve(err(new AppError(ErrorCode.EXTERNAL, `通知コマンドの起動に失敗しました: ${e instanceof Error ? e.message : String(e)}`, { details: { command: cmd.command } })));
        });
        child.on("close", () => {
          if (settled) return;
          settled = true;
          resolve(ok(cmd));
        });
        child.unref?.();
        // detached の場合 close が来ないことがあるので、error が無ければ成功とみなす
        if (settled === false) { settled = true; resolve(ok(cmd)); }
      } catch (e) {
        resolve(err(new AppError(ErrorCode.EXTERNAL, `通知コマンドの起動に失敗しました: ${e instanceof Error ? e.message : String(e)}`, { details: { command: cmd.command } })));
      }
    });
  }

  return {
    platform,
    async notify(n) {
      if (n.title.trim() === "" && n.message.trim() === "") {
        const e = err(new AppError(ErrorCode.VALIDATION, "title か message のいずれかは必要です"));
        log?.append({ at: now(), kind: "notify", title: n.title, message: n.message, platform, ok: false, error: e.error.message });
        return e;
      }
      const cmd = buildNotifyCommand(platform, n);
      const r = await runCommand(cmd);
      // 音付き通知で、OS が通知音を別途鳴らす必要がある場合(win/linux)は音も鳴らす
      if (r.ok && n.sound && (platform === "win32" || platform === "linux")) {
        await runCommand(buildSoundCommand(platform));
      }
      log?.append({ at: now(), kind: "notify", title: n.title, message: n.message, platform, ok: r.ok, ...(r.ok ? {} : { error: r.error.message }) });
      return r;
    },
    async playSound(soundFile) {
      const r = await runCommand(buildSoundCommand(platform, soundFile));
      log?.append({ at: now(), kind: "sound", platform, ok: r.ok, ...(r.ok ? {} : { error: r.error.message }) });
      return r;
    },
  };
}
