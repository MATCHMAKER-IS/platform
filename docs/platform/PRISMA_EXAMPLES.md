# Prisma モデル例(取り込み・列設定)

```prisma
/// 取り込み履歴
model ImportHistory {
  id         String   @id @default(cuid())
  source     String   // "csv" | "paste"
  userId     String
  importedAt DateTime
  total      Int
  inserted   Int
  errorCount Int
  status     String   // success | partial | failed
  createdAt  DateTime @default(now())
}

/// 列表示設定(ユーザー×テーブル)
model UserColumnPref {
  userId    String
  table     String
  prefs     Json
  updatedAt DateTime @updatedAt
  @@id([userId, table])
}
```

保存フロー: `saveConfirmedExpenses`(tools/import-service-example.ts)が
`withTransaction` 内で経費の一括作成と `ImportHistory` の記録を all-or-nothing で行う。
列設定は `createColumnPrefsStore({ endpoint, userId })` が `UserColumnPref` を GET/PUT する。

## 言語設定(ユーザー別・サーバ保存)

```prisma
/// ユーザーの言語設定
model UserLocalePref {
  userId    String   @id
  locale    String   // ja | en | zh | ko
  updatedAt DateTime @updatedAt
}
```

クライアントは `createFetchLocaleStore({ endpoint: "/api/locale", userId })` で GET/PUT。
`/api/locale` は `UserLocalePref` を upsert して返す。全端末で言語が共有される。
