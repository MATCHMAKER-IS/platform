# @platform/flags

フィーチャーフラグ(依存ゼロ)。kill switch・段階リリース・ターゲティング・A/B バリアント。
評価は決定的(同じキーは常に同じ結果)で、ユーザ単位で一貫した体験になります。

```ts
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
