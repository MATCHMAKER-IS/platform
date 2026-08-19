# @platform/os-notify

デスクトップ通知（OS の通知領域に出す）。

## これは何のためか

**ブラウザのタブを見ていなくても気づく**ためのものです。

## 使う前に知っておくこと

| | |
|---|---|
| **許可が要ります** | 断られると出せません——**なぜ要るかを説明してから**求めてください |
| **鳴りすぎると切られます** | 一度切られると、**設定を開かないと戻せません**——**本当に要るものだけ**にしてください |
| **本文に個人情報を入れない** | **画面がロックされていても表示**されます——**周りの人に見えます** |
| **クリックしたときの動きを決める** | 押しても何も起きないと、**次から押されません** |

## よく使うもの

```ts
import { buildNotifyCommand, buildSoundCommand, createMemoryNotifyLog } from "@platform/os-notify";
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
