# @platform/core

基盤全体で共有する **エラー規約(`AppError` / `ErrorCode`)** と **`Result` 型** を提供します。
他のすべての基盤パッケージはこれに依存し、「失敗の形」を統一します。

- `AppError` … コード・メッセージ・cause・details を持つ共通エラー
- `Result<T>` / `ok` / `err` / `tryCatch` … 例外を投げない失敗表現
