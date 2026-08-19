# @platform/device

端末の判定（スマホ / PC・画面の大きさ・位置情報）。

## これは何のためか

**画面の大きさに合わせて、出すものを変える**ためのものです。

スマホで表が横に伸びると、**何も読めません**。

## 使う前に知っておくこと

| | |
|---|---|
| **UA は偽装できます** | **守りには使わないで**ください——**表示の切り替え**にだけ使うものです |
| **サーバ側では `undefined`** | Next.js では**同じコードが両方で動きます**——**必ず確かめて**ください |
| **画面の大きさで判断する** | 「スマホかどうか」より「**幅が何 px か**」の方が確かです——**タブレットも折りたたみもあります** |
| **位置情報は許可が要ります** | **断られたときの動き**を必ず用意してください |

## よく使うもの

```ts
import { getClientInfo, requestGeolocation } from "@platform/device";
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
