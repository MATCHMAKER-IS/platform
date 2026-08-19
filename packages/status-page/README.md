# @platform/status-page

稼働状況の表示（障害・メンテナンスの告知）。

## これは何のためか

**「動かない」と問い合わせが集中するのを防ぐ**ためのものです。

**先に出しておけば、問い合わせは減ります**——
利用者も「気づいてもらえている」と分かります。

## 使う前に知っておくこと

| | |
|---|---|
| **設定は都度読む** | 起動時に読み込むと、**障害中に書き換えても反映されません**——**呼ばれるたびに最新**を取ります |
| **アプリと同じ場所に置かない** | アプリが落ちたら、**状況ページも落ちます**——本当は**別の場所**が望ましいです |
| **復旧の見込みを書く** | 「調査中」だけだと、**何度も見に来られます**。分からなくても**次に更新する時刻**は書いてください |
| **終わったら必ず消す** | 直ったのに「障害中」が残っていると、**次から誰も見なくなります** |

## よく使うもの

```ts
import { isInMaintenanceWindow, createMaintenanceGate, stateToConfig } from "@platform/status-page";
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

## プリセットの上書き

`renderMaintenancePage` などのプリセットは、`title` / `message` / `showReload` などを
部分的に上書きできます。**`undefined` は「指定なし」として扱い、既定値を残します。**

```ts
// message を指定しなければ既定文が出る
renderNotFoundPage({ brand: "社内システム" });

// options?.message のように「有るかもしれない値」をそのまま渡してよい
renderNotFoundPage({ message: cfg?.message });
```

> 2026-07 まで、`{ message: undefined }` を渡すと既定の本文が消える不具合がありました
> (既定値をスプレッドより前に置いていたため)。`message` は必須項目なので、
> **エラー画面が本文の無い画面になる**という、いちばん出したくない壊れ方をしていました。
> 現在は修正済みで、回帰テストがあります。

