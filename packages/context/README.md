# @platform/context

リクエストごとの文脈（追跡 ID・利用者・テナント）。

## これは何のためか

**「このログはどのリクエストのものか」を繋ぐ**ためのものです。

引数で渡すと、**全ての関数に引数が増えます**——
**深いところまで届かない**か、**渡し忘れます**。

## 使う前に知っておくこと

| | |
|---|---|
| **コンテキストの外では `undefined`** | 起動時の処理やバッチでは**入っていません**——**必ず確かめて**ください |
| **設定はスプレッドより後に** | `{ ...base, traceId }` の順です。逆にすると**上書きされます** |
| **文脈に大きなものを入れない** | リクエストの間ずっと**メモリに残ります** |
| **秘密を入れない** | ログに出る経路があるためです |

## よく使うもの

```ts
import { runWithContext, getContext } from "@platform/context";
import { runWithContext, bindLogger, setContextValue } from "@platform/context";

// リクエスト境界で
await runWithContext({}, async () => {
  const reqLog = bindLogger(log);           // requestId 付きロガー
  setContextValue("userId", user.id);       // 認証後に付与
  reqLog.info({}, "処理開始");               // requestId/userId が自動で乗る
});
```

## requestId の採番

`requestId` は **渡さなくても、`undefined` を渡しても採番されます**。
上流(ロードバランサ・呼び出し元アプリ)のヘッダをそのまま渡してよい設計です。

```ts
// どちらも採番される
runWithContext({}, fn);
runWithContext({ requestId: req.headers.get("x-request-id") ?? undefined }, fn);
```

> 2026-07 まで、`requestId: undefined` を明示的に渡すと採番結果が消える不具合がありました
> (既定値をスプレッドより前に置いていたため)。現在は修正済みで、回帰テストがあります。

## ロガーとつなぐ

`@platform/logger` の `contextProvider` に差すと、**個々の呼び出しで書かなくても**
全ログに `requestId` / `userId` が乗ります。書かせる方式は必ずどこかで抜けます。

```ts
export const logger = createLogger({
  base: { service: "my-app" },
  contextProvider: () => getContext() ?? {},
});
```

実際の配線は `apps/crud-template/src/server/instrument.ts`(API を包む 1 箇所で
`runWithContext` を張る)と `authorize.ts`(身元が確定した時点で `userId` を足す)を参照。
