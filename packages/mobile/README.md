# @platform/mobile

タブレット・スマホなどモバイル端末向けの処理。レスポンシブ判定・ネットワーク状態・画面向きの
純ロジックと、それを購読する React フック、共有・触覚・クリップボード等のブラウザ操作ラッパー
(feature detection つき・非対応環境でも安全)。

## レスポンシブ / 画面
```tsx
import { useBreakpoint, useDeviceSize, useIsMobile, useOrientation, useViewportSize } from "@platform/mobile";
const size = useDeviceSize();   // "mobile" | "tablet" | "desktop"
const bp = useBreakpoint();     // "xs" | "sm" | "md" | ...
if (useIsMobile()) { /* スマホ向けレイアウト */ }
```
純ロジック `matchBreakpoint(width)` / `deviceSizeFromWidth(width)` はテスト・SSR でも使えます。

## ネットワーク状態(現場・低速回線対応)
```tsx
import { useNetworkStatus, useOnlineStatus } from "@platform/mobile";
const { online, quality, saveData } = useNetworkStatus();  // quality: "slow"|"moderate"|"fast"...
if (!online) showOfflineBanner();
if (quality === "slow" || saveData) skipAutoImageLoad();   // 画像圧縮・自動再生抑制
```
純ロジック `classifyConnection({ effectiveType, downlink, online })` / `shouldSaveData(quality)`。

## スリープ防止・可視性(バーコード読取・キオスク)
```tsx
import { useWakeLock, usePageVisibility } from "@platform/mobile";
useWakeLock(scanning);          // scanning の間、画面を点灯し続ける
const visible = usePageVisibility();  // タブがアクティブか
```

## 端末操作(共有・触覚・クリップボード・PWA)
```ts
import { share, vibrate, copyToClipboard, isStandalone, isTouchPrimary } from "@platform/mobile";
await share({ title: "報告書", url });   // ネイティブ共有シート(非対応なら false)
vibrate(50);                              // 触覚フィードバック
await copyToClipboard(text);
if (isStandalone()) { /* ホーム画面から起動されたPWA */ }
```
すべて feature detection つきで、非対応環境では安全に false を返します。

## カメラ撮影(現場の写真報告・書類撮影)
```tsx
import { startCamera, stopStream, captureFrame, listCameras } from "@platform/mobile";
const stream = await startCamera({ facing: "environment" });  // 背面カメラ(書類/バーコード向き)
videoRef.current.srcObject = stream;
// 撮影ボタンで現在フレームを取り込み
const blob = await captureFrame(videoRef.current, { width: 1280, quality: 0.9 });
stopStream(stream);  // 使い終わったら解放
```
制約の組み立て `cameraConstraints({ facing, deviceId })` は純ロジック。前面/背面の切替や特定カメラの指定に対応します。

## バーコード読取(棚卸し・入出荷)
JAN/EAN のチェックディジット検証は純ロジック、読み取りは BarcodeDetector API(対応環境)を使います。
```ts
import { detectBarcodes, isValidJan, isJapaneseJan, detectBarcodeKind } from "@platform/mobile";

// 妥当性チェック(純ロジック・どの環境でも)
isValidJan("4901777018686");     // true(実在の JAN)
isJapaneseJan("4901777018686");  // true(45/49 始まり)

// カメラ映像から読み取り(非対応環境では空配列 → 手入力にフォールバック)
const found = await detectBarcodes(videoRef.current, ["ean_13", "qr_code"]);
for (const b of found) if (isValidJan(b.rawValue)) addToInventory(b.rawValue);
```
BarcodeDetector 非対応のブラウザでは `detectBarcodes` は空配列を返すため、専用のデコードライブラリ(ZXing 等)への切替や手入力で補えます。
EOF_MARKER

## PWA（Android / iOS のホーム画面から開く）

ネイティブアプリを作らずに、ホーム画面のアイコンから起動できるようにします。

```ts
// app/manifest.json/route.ts
import { buildWebManifest } from "@platform/mobile";
export function GET() {
  return Response.json(buildWebManifest({
    name: "社内システム", shortName: "社内", themeColor: "#1e40af",
    icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }],
  }));
}

// app/sw.js/route.ts
import { buildServiceWorker } from "@platform/mobile";
export function GET() {
  return new Response(buildServiceWorker({ version: "2026-07-23", precache: ["/", "/offline"], offlineFallback: "/offline" }),
    { headers: { "Content-Type": "text/javascript" } });
}
```

`checkInstallable()` が、インストールできない原因（アイコン不足・短い名前が長すぎる等）を具体的に示します。
ブラウザは「インストールできない」としか言わないためです。

### 押さえている点

| 点 | 内容 |
|---|---|
| **iOS は自動で促せない** | 「共有 → ホーム画面に追加」を手で選んでもらう。`installGuidance()` が端末別の手順を返す |
| **API はキャッシュしない** | 古い在庫数や承認状態を見せる方が、オフラインで見えないことより害が大きい |
| **GET 以外は素通し** | 送信・更新をキャッシュすると二重送信になる |
| **iOS の通知は条件つき** | 16.4 以降 **かつホーム画面に追加**していないと使えない。タブでは許可を求めても失敗する |
| **許可を求めるタイミング** | 開いた直後に求めない。拒否は覚えられ、設定画面からしか戻せない |

### ネイティブアプリが要る場合

カメラ・バーコード・Bluetooth・位置情報は Web の API で扱えます（このパッケージが対応）。
**Web でできないこと**（バックグラウンドでの常時位置取得、他アプリとの深い連携、
オフラインでの大量データ保持）が必要になったときに、初めてネイティブを検討してください。

## 実アプリでの設定例

`apps/internal-app` が実際に対応しています。必要なのは次の 4 つだけです。

| 置くもの | 役割 |
|---|---|
| `src/app/manifest.json/route.ts` | manifest を返す（`buildWebManifest`） |
| `src/app/sw.js/route.ts` | Service Worker を返す（`buildServiceWorker`） |
| `src/app/offline/page.tsx` | 圏外のときに出す画面 |
| `src/components/ServiceWorkerRegister.tsx` | 登録する（layout に置く。失敗しても業務は止めない） |

加えて `layout.tsx` の `metadata.manifest` と `viewport.themeColor`、
`public/icon-192.png` / `icon-512.png` が要ります。

### 更新したのに古い画面が出るとき

`buildServiceWorker` の `version` を変えてください。**版が変わると古いキャッシュが捨てられます**。
日付にしておくと、いつの版か分かります。
