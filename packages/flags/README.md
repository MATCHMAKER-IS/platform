# @platform/flags

段階的な公開（フィーチャーフラグ）。**一部の人にだけ先に出します**。

## これは何のためか

**新しい機能を全員に一度に出すと、壊れたときに全員が困ります。**

まず情シスだけ、次に営業部——と広げれば、
**問題が出ても影響が小さく、戻すのも簡単**です。

## 使う前に知っておくこと

| | |
|---|---|
| **`flagName` を必ず渡す** | 省略すると**すべてのフラグで同じ集団が選ばれます**——「いつも同じ人が実験台」になり、**その人たちだけが未検証の機能を次々に踏みます**。**省略しても動く**ので気づきにくい |
| **同じ利用者は常に同じ結果** | 画面を開くたびに変わると、**「さっきはできたのに」**になります |
| **消す予定を決めてから足す** | フラグは**増える一方**です。**いつ消すか**を決めずに足すと、**条件分岐だらけ**になります |
| **本番で試すのは「壊れても戻せるもの」だけ** | 金額の計算を段階公開すると、**一部の人だけ違う額**になります |

## よく使うもの

```ts
import { bucketOf, evaluateFlag, selectVariant } from "@platform/flags";
import { createFlags, createStaticProvider } from "@platform/flags";

const flags = createFlags(createStaticProvider({
  "new-ui": { rolloutPercent: 10 },              // 10% に段階公開
  "beta-export": { allow: [{ role: "admin" }] }, // admin だけ先行
  "legacy-import": false,                          // kill switch(即オフ)
}));

await flags.isEnabled("new-ui", { key: userId }); // 決定的にオン/オフ
```

未定義フラグは `false`(安全側)。取得元は env / リモート設定サービスに差し替え可能。
障害時の緊急停止(kill switch)や段階リリースの安全弁として使います。

## 引数の名前に注意

**`createFlags` を使うのが安全です。** フラグ名を自動で渡すので、
下の落とし穴を踏みません。

```ts
const flags = createFlags(provider);
if (await flags.isOn("newUI", { key: user.id })) { … }
```

`evaluateFlag` を直接呼ぶ場合、**名前を間違えやすい 3 点**があります。

| 正しい | 間違えやすい | 間違えるとどうなるか |
|---|---|---|
| `rolloutPercent` | `rollout` | **割合が効かず全員に出る** |
| `context.key` | `context.userId` | **誰も選ばれない**(0%になる) |
| 第 3 引数 `flagName` | 省略 | **すべてのフラグで同じ集団**が選ばれる |

とくに 3 つ目が見つけにくい形です。省略しても動くので気づきませんが、
**「いつも同じ人が実験台」**になり、その人たちだけが未検証の機能を次々に踏みます。

```ts
// ❌ 割合が効かない・誰も選ばれない・同じ集団
evaluateFlag({ enabled: true, rollout: 10 }, { userId: user.id });

// ✅
evaluateFlag({ enabled: true, rolloutPercent: 10 }, { key: user.id }, "newUI");
```

## 緊急停止

`enabled: false` は**割合を問わず全員 false** になります。
不具合が見つかったとき、割合を 0 にするより確実です。
