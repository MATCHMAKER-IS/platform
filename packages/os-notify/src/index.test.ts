import { describe, it, expect } from "vitest";
import {
  buildNotifyCommand, buildSoundCommand, createMemoryNotifyLog, createOsNotifier,
  type SpawnLike,
} from "./index";

/** spawn の記録用スタブ。 */
function fakeSpawn(behavior: "close" | "error" = "close") {
  const calls: { command: string; args: string[] }[] = [];
  const spawn: SpawnLike = (command, args) => {
    calls.push({ command, args });
    return {
      on(event, cb) {
        if (event === behavior) setTimeout(() => cb(behavior === "error" ? new Error("起動できません") : 0), 0);
      },
      unref() {},
    };
  };
  return { calls, spawn };
}

describe("buildNotifyCommand", () => {
  const n = { title: "完了", message: "バッチが終わりました" };

  it("Windows は PowerShell のトースト通知", () => {
    const cmd = buildNotifyCommand("win32", n);
    expect(cmd.command).toBe("powershell");
    expect(cmd.args[0]).toBe("-NoProfile");
    expect(cmd.args.join(" ")).toContain("完了");
  });

  it("macOS は osascript", () => {
    const cmd = buildNotifyCommand("darwin", n);
    expect(cmd.command).toBe("osascript");
    expect(cmd.args.join(" ")).toContain("display notification");
  });

  it("Linux は notify-send(**引数をそのまま渡す**のでシェル解釈が起きない)", () => {
    const cmd = buildNotifyCommand("linux", n);
    expect(cmd).toEqual({ command: "notify-send", args: ["完了", "バッチが終わりました"] });
  });

  it("macOS は sound 指定で音を付ける", () => {
    expect(buildNotifyCommand("darwin", { ...n, sound: true }).args.join(" ")).toContain("sound name");
    expect(buildNotifyCommand("darwin", n).args.join(" ")).not.toContain("sound name");
  });
});

describe("コマンド組み立てのエスケープ", () => {
  it("**PowerShell のシングルクォートを閉じられない**", () => {
    // ' を '' にしないと、そこからコマンドを差し込める
    const cmd = buildNotifyCommand("win32", { title: "a'; calc; '", message: "m" });
    const script = cmd.args.join(" ");
    expect(script).toContain("a''; calc; ''");
    expect(script).not.toContain("('a'; calc; '')");
  });

  it("**AppleScript のダブルクォートを閉じられない**", () => {
    const cmd = buildNotifyCommand("darwin", { title: 't" & (do shell script "id") & "', message: "m" });
    const script = cmd.args.join(" ");
    expect(script).toContain('\\"');
    // エスケープされていない生の `"` で文字列が閉じていないこと
    expect(script.includes('with title "t" &')).toBe(false);
  });

  it("AppleScript のバックスラッシュもエスケープする", () => {
    expect(buildNotifyCommand("darwin", { title: "a\\b", message: "m" }).args.join(" ")).toContain("a\\\\b");
  });

  it("**Linux は引数配列なのでエスケープ不要**(シェルを経由しない)", () => {
    const cmd = buildNotifyCommand("linux", { title: "a; rm -rf /", message: "m" });
    expect(cmd.args[0]).toBe("a; rm -rf /"); // そのまま argv に渡る = 解釈されない
  });

  it("PowerShell の音声ファイル名もエスケープする", () => {
    const cmd = buildSoundCommand("win32", "C:\\a'; calc; '.wav");
    expect(cmd.args.join(" ")).toContain("''");
  });
});

describe("buildSoundCommand", () => {
  it("ファイル未指定なら OS の既定音", () => {
    expect(buildSoundCommand("win32").args.join(" ")).toContain("Beep");
    expect(buildSoundCommand("darwin").args[0]).toContain("Ping.aiff");
    expect(buildSoundCommand("linux")).toEqual({ command: "sh", args: ["-c", "printf '\\a'"] });
  });

  it("ファイル指定で再生コマンドになる", () => {
    expect(buildSoundCommand("darwin", "/tmp/a.aiff")).toEqual({ command: "afplay", args: ["/tmp/a.aiff"] });
    expect(buildSoundCommand("linux", "/tmp/a.wav")).toEqual({ command: "paplay", args: ["/tmp/a.wav"] });
  });
});

describe("createMemoryNotifyLog", () => {
  it("新しい順に返す", () => {
    const log = createMemoryNotifyLog();
    log.append({ at: 1, kind: "notify", platform: "linux", ok: true });
    log.append({ at: 2, kind: "sound", platform: "linux", ok: true });
    expect(log.list().map((e) => e.at)).toEqual([2, 1]);
  });

  it("**上限を超えたら古いものから捨てる**(履歴が無限に増えない)", () => {
    const log = createMemoryNotifyLog({ max: 2 });
    for (const at of [1, 2, 3]) log.append({ at, kind: "notify", platform: "linux", ok: true });
    expect(log.list().map((e) => e.at)).toEqual([3, 2]);
  });

  it("件数を指定して取れる", () => {
    const log = createMemoryNotifyLog();
    for (const at of [1, 2, 3]) log.append({ at, kind: "notify", platform: "linux", ok: true });
    expect(log.list(2).map((e) => e.at)).toEqual([3, 2]);
  });
});

describe("createOsNotifier", () => {
  it("**spawn を渡さなければ実行しない**(コマンドを組み立てるだけ)", async () => {
    const notifier = createOsNotifier({ platform: "linux" });
    const r = await notifier.notify({ title: "t", message: "m" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.command).toBe("notify-send");
  });

  it("spawn を渡すと実際に呼ぶ", async () => {
    const { calls, spawn } = fakeSpawn();
    const notifier = createOsNotifier({ platform: "linux", spawn });
    await notifier.notify({ title: "t", message: "m" });
    expect(calls[0]?.command).toBe("notify-send");
  });

  it("**title も message も空なら VALIDATION**(意味のない通知を出さない)", async () => {
    const notifier = createOsNotifier({ platform: "linux" });
    const r = await notifier.notify({ title: " ", message: "" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDATION");
  });

  it("どちらか片方あれば通す", async () => {
    const notifier = createOsNotifier({ platform: "linux" });
    expect((await notifier.notify({ title: "t", message: "" })).ok).toBe(true);
    expect((await notifier.notify({ title: "", message: "m" })).ok).toBe(true);
  });

  it("起動に失敗したら EXTERNAL(例外を投げない)", async () => {
    const { spawn } = fakeSpawn("error");
    const notifier = createOsNotifier({ platform: "linux", spawn });
    const r = await notifier.notify({ title: "t", message: "m" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("EXTERNAL");
  });

  it("**Linux/Windows は音を別コマンドで鳴らす**(通知だけでは鳴らない)", async () => {
    const { calls, spawn } = fakeSpawn();
    const notifier = createOsNotifier({ platform: "linux", spawn });
    await notifier.notify({ title: "t", message: "m", sound: true });
    expect(calls.map((c) => c.command)).toEqual(["notify-send", "sh"]);
  });

  it("macOS は通知コマンドに音が含まれるので別途鳴らさない", async () => {
    const { calls, spawn } = fakeSpawn();
    const notifier = createOsNotifier({ platform: "darwin", spawn });
    await notifier.notify({ title: "t", message: "m", sound: true });
    expect(calls.map((c) => c.command)).toEqual(["osascript"]);
  });

  it("履歴に成功・失敗を残す", async () => {
    const log = createMemoryNotifyLog();
    const okNotifier = createOsNotifier({ platform: "linux", log, now: () => 100 });
    await okNotifier.notify({ title: "t", message: "m" });
    const ngNotifier = createOsNotifier({ platform: "linux", log, spawn: fakeSpawn("error").spawn, now: () => 200 });
    await ngNotifier.notify({ title: "t", message: "m" });
    expect(log.list().map((e) => e.ok)).toEqual([false, true]);
    expect(log.list()[0]?.error).toBeTruthy();
  });

  it("入力が不正でも履歴に残す(なぜ出なかったか分かる)", async () => {
    const log = createMemoryNotifyLog();
    await createOsNotifier({ platform: "linux", log }).notify({ title: "", message: "" });
    expect(log.list()[0]?.ok).toBe(false);
  });

  it("playSound も履歴に残る", async () => {
    const log = createMemoryNotifyLog();
    await createOsNotifier({ platform: "linux", log }).playSound();
    expect(log.list()[0]?.kind).toBe("sound");
  });

  it("platform 未指定は linux 扱い", () => {
    expect(createOsNotifier().platform).toBe("linux");
  });
});
