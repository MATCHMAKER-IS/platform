# @platform/context

リクエストスコープのコンテキスト(相関ID)。`AsyncLocalStorage` で 1 リクエストの間
`requestId` / `userId` を持ち回り、全ログに自動付与できます。障害調査が一気に楽になります。

```ts
import { runWithContext, bindLogger, setContextValue } from "@platform/context";

// リクエスト境界で
await runWithContext({}, async () => {
  const reqLog = bindLogger(log);           // requestId 付きロガー
  setContextValue("userId", user.id);       // 認証後に付与
  reqLog.info({}, "処理開始");               // requestId/userId が自動で乗る
});
```
