# E2E テスト(Playwright)

showcase デモを対象にした E2E 雛形です。

```bash
pnpm exec playwright install   # 初回のみ(ブラウザ取得)
pnpm e2e                        # ヘッドレス実行(dev サーバは自動起動)
pnpm e2e:ui                     # UI モードで対話実行
```

`playwright.config.ts` の `webServer` が showcase を自動起動します。
`baseURL` は `E2E_BASE_URL` で上書き可能(ステージング環境の検証など)。
`e2e/*.spec.ts` を追加してページ・フォーム・遷移を検証してください。
Cursor では Playwright 拡張(推奨拡張に含む)からテスト実行・トレース確認ができます。
