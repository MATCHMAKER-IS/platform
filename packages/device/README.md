# @platform/device

端末・ブラウザ・OS・ネットワーク等のクライアント情報取得。

```ts
// サーバ(User-Agent から)
import { parseUserAgent } from "@platform/device";
const ua = parseUserAgent(req.headers.get("user-agent") ?? "");
// ua.browser.name / ua.os.name / ua.device.type

// クライアント(navigator 等から一式)
import { getClientInfo, requestGeolocation } from "@platform/device";
const info = getClientInfo();
// info.screen / info.network / info.locale / info.preferences / info.capabilities ...
const geo = await requestGeolocation(); // 要許可
```

## 取得できる情報
- **UA**: ブラウザ / エンジン / OS / 端末種別(mobile/tablet/desktop)/ ベンダー・モデル / CPU アーキ
- **ハードウェア**: 論理コア数 / 端末メモリ(GB)/ タッチポイント数
- **画面**: 解像度 / ピクセル比 / 色深度 / 向き、ビューポートサイズ
- **ネットワーク**: オンライン / 実効速度(4g等)/ ダウンリンク / RTT / データセーバー
- **ロケール**: 言語 / タイムゾーン
- **設定**: ダーク/ライト / モーション低減
- **機能**: タッチ対応 / Cookie 有効 / PWA スタンドアロン
- **位置情報**: 緯度経度(要許可)
