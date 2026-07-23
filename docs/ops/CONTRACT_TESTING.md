# 外部SaaSとの契約テスト

## なぜ必要か

外部 API（freee / Google / PayPal など）は、こちらの都合と関係なく変わります。
自前のテストは**モックを相手にしているので通り続け**、壊れたことに気づくのは
利用者からの連絡になりがちです。

そこで「**うちのコードが相手の応答のどのフィールドに依存しているか**」を
契約として明文化し、実際に記録した応答と突き合わせます。

## 仕組み

| 場所 | 役割 |
|---|---|
| `tests/contracts/*.contract.json` | 契約（依存フィールド・実装ファイル・記録した応答） |
| `tools/check-contract.mjs` | 突き合わせ。preflight と CI から実行 |
| `.github/workflows/contract.yml` | 週次で**本物の API** に問い合わせて記録を更新し、厳格モードで検査 |

検査内容:

- **C001** 契約ファイルの形式
- **C002** 契約が指す実装ファイルの存在
- **C003** 契約の必須フィールドを**実装が本当に参照しているか**（契約と実装のズレ）
- **C004** 記録した応答に必須フィールドが**揃っているか**（相手の API 変更）
- **C005** 記録が古すぎないか（既定 90 日）

## 実行

```bash
node tools/check-contract.mjs                 # 通常（未記録は警告どまり。preflight はこちら）
CONTRACT_STRICT=1 node tools/check-contract.mjs   # 本番前・定期CI（未記録/期限切れも失敗）
```

## 契約を追加する

1. `tests/contracts/<name>.contract.json` を作る

```json
{
  "connector": "freee",
  "title": "freee OAuth トークン更新",
  "endpoint": "POST https://accounts.secure.freee.co.jp/public_api/token",
  "sourceFile": "packages/freee/src/token.ts",
  "requiredFields": ["access_token", "refresh_token", "expires_in"],
  "note": "欠けるとトークン更新ができず連携が全面停止する",
  "capturedAt": null,
  "fixture": null
}
```

2. `requiredFields` には、**実装が実際に読んでいるフィールドだけ**を書く
   （書いたのに実装が読んでいなければ C003 で落ちます）
3. 任意項目（あってもなくても動くもの）は含めない

## 実応答を記録する

`fixture` に**本物の応答**を入れ、`capturedAt` に記録日を入れます。

- **秘密情報は必ず伏せる**（`access_token` の値は `"<redacted>"` などで可。
  検査しているのは**フィールドの有無**であって値ではありません）
- 手で貼っても構いませんし、CI（`contract.yml`）に任せても構いません

## 落ちたときの読み方

| 表示 | 意味 | 対応 |
|---|---|---|
| C003 | 契約に書いたフィールドを実装が読んでいない | 契約を実装に合わせて直す |
| C004 | 記録した応答に必須フィールドが無い | **相手の API が変わった**。実装の追随が必要 |
| C005 | 記録が古い | 取り直す（週次 CI が動いていれば自動） |

## 限界

- 記録した瞬間の応答しか見ていません。**週次で取り直すこと**が前提です
- フィールドの**有無**だけを見ます。型や意味の変更（例: 単位が円→銭）は検知できません
- 相手のサンドボックス環境と本番で応答が違う場合があります
