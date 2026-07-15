# @platform/os-notify

OS ネイティブのデスクトップ通知・音を鳴らします(Windows / macOS / Linux)。

`@platform/notify` が Slack / メール / SMS など「外部サービスへの通知」を扱うのに対し、こちらは**実行中のマシン自身**に通知・音を出す用途です(常駐ツール・RPA・バッチの完了通知など)。

- `buildNotifyCommand(platform, { title, message, sound })`: OS 別の通知コマンドを生成(純関数)
- `buildSoundCommand(platform, soundFile?)`: OS 別の音コマンドを生成(純関数)
- `createOsNotifier({ platform, spawn })`: 通知ランナー。`spawn` を渡すと実行、渡さなければ dry-run(コマンド生成のみ)

| OS | 通知 | 音 |
|---|---|---|
| Windows | PowerShell トースト(標準 API・追加モジュール不要) | `[console]::Beep` / SoundPlayer |
| macOS | `osascript display notification` | `afplay` |
| Linux | `notify-send` | `paplay` / 端末ベル |

```ts
import { spawn } from "node:child_process";
import { createOsNotifier, type OsPlatform } from "@platform/os-notify";

const notifier = createOsNotifier({ platform: process.platform as OsPlatform, spawn });
await notifier.notify({ title: "完了", message: "バッチが終わりました", sound: true });
```

コマンド生成が純関数なので、child_process 無しで「どの OS でどんなコマンドを組むか」を単体テストできます。文字列はシェル/PowerShell 向けにエスケープ済みです。

## 通知履歴

`log` に `OsNotifyLogStore` を渡すと、送った通知(成功/失敗)が記録されます。

```ts
import { createOsNotifier, createMemoryNotifyLog } from "@platform/os-notify";
const log = createMemoryNotifyLog({ max: 200 });
const notifier = createOsNotifier({ platform: "linux", spawn, log });
await notifier.notify({ title: "完了", message: "終了" });
log.list(50); // 新しい順の履歴
```
