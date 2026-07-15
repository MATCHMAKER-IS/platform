# @platform/status-page

メンテナンス/システムエラー/停止/404 の画面テンプレートと、メンテナンス切り替えゲート。
依存ゼロで外部リソースを読み込まない自己完結 HTML なので、middleware・error boundary・
静的配信のいずれからも安全に使えます(壊れている時ほど確実に表示できる)。

## 画面テンプレート
```ts
import { renderMaintenancePage, renderErrorPage } from "@platform/status-page";

renderMaintenancePage({ brand: "社内システム", estimatedRecovery: "本日 22:00" });
renderErrorPage({ referenceId: traceId, brand: "社内システム" }); // 参照IDでサポート追跡
```
`renderStatusPage`(汎用)/ `renderMaintenancePage` / `renderErrorPage` /
`renderServiceUnavailablePage` / `renderNotFoundPage`。ダークモード対応・レスポンシブ・
HTML エスケープ済み・`noindex` 付き。

## メンテナンス切り替えゲート
オン/オフの情報源(env・フラグ・設定ストア)を注入し、リクエストごとに「メンテ画面を出すか」を判定します。
```ts
import { createMaintenanceGate } from "@platform/status-page";

const gate = createMaintenanceGate(() => ({
  enabled: process.env.MAINTENANCE === "1",          // 手動スイッチ
  window: { start: "2025-08-01T02:00:00+09:00", end: "2025-08-01T04:00:00+09:00" }, // 予定メンテ(自動オン/オフ)
  allowRoles: ["admin"],                              // 管理者は保守中も操作可
  allowIps: ["10.0.0.1"],                            // 社内/監視系は素通し
  bypassHeader: { name: "x-maintenance-bypass", value: process.env.BYPASS_TOKEN! },
  estimatedRecovery: "本日 4:00",
}));

const decision = gate.evaluate({ path, ip, roles, getHeader });
if (decision.active) { /* 503 + Retry-After + renderMaintenancePage() を返す */ }
```
ヘルスチェック・静的アセットは既定で素通し。予定期間(`window`)で自動オン/オフ、
`allowRoles`/`allowIps`/`bypassHeader` で運用者だけ確認できます。

Next.js の `middleware.ts` で使うのが基本です(アプリ側の配線例は `apps/internal-app`)。

## 管理画面から再起動なしで切り替える(GUI トグル)

env フラグの代わりに、DB 等のストアを情報源にすると、管理画面のトグルで即オン/オフできます
(デプロイ・再起動不要)。middleware は毎リクエスト評価するため TTL キャッシュと併用します。

```ts
import { createAsyncMaintenanceGate, createCachedConfig, stateToConfig } from "@platform/status-page";

// 状態は DB 実装(MaintenanceStore)から。静的ポリシーは合成する。
const cachedConfig = createCachedConfig(async () =>
  stateToConfig(await store.get(), { allowRoles: ["admin"], retryAfterSeconds: 3600 }), 5000);
const gate = createAsyncMaintenanceGate(cachedConfig);

const decision = await gate.evaluate({ path, roles, getHeader });
```

- `MaintenanceState`(永続化する状態)/ `MaintenanceStore`(get/set の最小 IF・DB 実装はアプリ側)。
- `stateToConfig(state, policy)` … 保存状態と静的ポリシー(許可ロール/IP/バイパス)を合成。
- `createAsyncMaintenanceGate` … 非同期の設定源に対応。
- `createCachedConfig(fetch, ttlMs)` … ストアアクセスを TTL で間引く(同時アクセスは1本化)。
- `createMemoryMaintenanceStore()` … テスト/デモ用の参照実装。

> **Next.js middleware で DB を読む場合は Node ランタイムが必要です**(Prisma は Edge 非対応)。
> アプリ側の配線例(DB ストア + 管理 API + 管理 UI)は `apps/internal-app` を参照。

