# @platform/logger

pino をラップした構造化ロガー。`console.log` の代わりにこれを使います。

```ts
import { createLogger } from "@platform/logger";
const log = createLogger({ base: { service: "internal-app" } });
log.info({ userId: 1 }, "ログイン成功");
```
