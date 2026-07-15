# @platform/faker

日本語のダミーデータ生成(@faker-js/faker の ja ロケール)。開発シード・デモ・負荷試験用。

```ts
import { seedMany, japaneseName, email, address, setSeed } from "@platform/faker";
setSeed(1); // 再現可能にしたいとき
const customers = seedMany(100, () => ({ name: japaneseName(), email: email(), address: address() }));
```

> テストの固定値は `@platform/testing` のファクトリを使ってください。
> こちらは「現実的なダミーを量産する」用途です。
