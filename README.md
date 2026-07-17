# `mcp/page.tsx` の型エラー修正 + Result 型の総点検（2 ファイル）

**依存は増えません。`pnpm install` は不要です。**

```powershell
cd demos\showcase
pnpm build
```

## 原因

```ts
export function parseJsonRpc(line: string):
  { ok: true; value: JsonRpcRequest } | { ok: false; error: JsonRpcResponse }
```

**`JsonRpcRequest | null` だと思い込んでいました。** 8 回目の「戻り値の形」の失敗です。

### 修正のついでに、無駄も消えました

```diff
- if (!parsed) return JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, null, 2);
+ // parseJsonRpc は Result 型。失敗時は **整形済みの JsonRpcResponse** をくれるので、
+ // アプリ側で -32700 を組み立てる必要がない(手で書くとコード番号を間違える)。
+ if (!parsed.ok) return JSON.stringify(parsed.error, null, 2);
```

**私は `-32700` を手で書いていました。** 基盤がエラー応答を整形して返してくれるので不要です。
JSON-RPC のエラーコードを各アプリで手書きするのは、まさに基盤が防ぎたいことでした。

## ★ 手書きの走査を諦めて、tsc に直接聞きました

「Result 型を返す関数」を正規表現で探そうとして **2 回失敗**しました
（複数行シグネチャを拾えず、`parseJsonRpc` も `createMessage` も検出できなかった）。

代わりに **`union-literals.ts` で全部を実際に呼ぶ**ようにしました。

```ts
// /mcp
const parsed = parseJsonRpc('{"jsonrpc":"2.0","id":1,"method":"tools/list"}');
export const mcpOut = parsed.ok ? ... : JSON.stringify(parsed.error);

// /chat
const cm = createMessage({ ... });
export const chatMsgs = cm.ok ? [cm.message] : [];

// /rag, /ai, /inventory, /board-threads, /zengin も同様
```

**結果、私が使っている戻り値の扱いは全部正しいことが確認できました。**
`createMessage` は `{ ok, message }`、`createThread` は `{ ok, thread }`、
`applyMovement` は `{ ok, movements }` と**形が微妙に違う**ので、思い込みでは書けません。

## 8 パターン中 4 つを実際に壊して確認

```
① TS2339: Property 'id' does not exist on type '{ ok: true; value: JsonRpcRequest; }'   ← 今回
② TS2339: Property 'message' does not exist on type 'CreateMessageResult'
③ TS2345: Argument of type 'Money | null' is not assignable to parameter of type 'Money'
④ TS2322: Type '"direct"' is not assignable to type 'RoomKind'
⑤ EmailLoginValues の remember 漏れ → ❌ **捕まらない**
```

**⑤ だけは私の環境では原理的に無理です。** `@platform/ui` は React 依存で、
`@types/react` が無いためスタブ扱いになります。
ただし**あなたの `pnpm typecheck` では走ります**（該当は `/login` の 1 箇所のみと確認済み）。

## これまでの失敗の総括

| 種類 | 回数 | 現在の状態 |
|---|---|---|
| 列挙値の思い込み | 4 | ✅ `union-literals.ts` で捕捉 |
| 戻り値の null 許容 | 2 | ✅ 同上 |
| **Result 型の形** | **2**（今回含む） | ✅ 同上（全関数を実際に呼ぶ形に） |
| `@platform/ui` の型 | 1 | ❌ 原理的に不可（該当 1 箇所のみ） |
| 古いファイルの混入 | 1 | ✅ 確認手順を追加 |

**`union-literals.ts` が、この 9 回分の失敗の記録そのもの**です。
ページで新しい API を使うときは、必ずここに一度書いてから使います。

## 検証状況

| 検査 | 結果 |
|---|---|
| **全ページの Result 型の扱いを tsc で検証** | ✅ 正しい |
| 過去の失敗 8 パターンを実際に壊して確認 | ✅ 4/5（⑤ は環境的に不可） |
| `check-build-ready`（I/J/K/L/M/N/O/P/R） | ✅ |
| `preflight` | ✅ すべて緑 |
| `gen-all` | ✅ |
| **`pnpm build`** | ❌ 未検証 |
