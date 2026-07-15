# @demos/upload — ファイルアップロードの完成テンプレート

`@platform/ui` の `FileUpload` + `useUpload` + `Progress` を束ねた `UploadPanel`。

| 役割 | 部品 |
| --- | --- |
| ドロップ選択 | `FileUpload`（accept/multiple/onFilesChange） |
| 送信(進捗付き) | `useUpload({ url, headers })` → progress/uploading/upload |
| 進捗表示 | `Progress` |
| 完了/失敗通知 | `toast.success` / `toast.error` |

## 流れ
1. ドロップ/選択 → クライアント側でサイズ超過を弾き(`toast.error`)、残りを一覧表示。
2. アップロードで進捗バー表示、完了で `toast.success`（失敗で `toast.error`）。

CSRF トークン等は `headers` に渡します。サーバ側の保存は `@platform/storage` / `@platform/upload`（署名付きURL 等）と組み合わせます。
