# @demos/interactions — ショートカット & 右クリック操作の実結線例

`@platform/ui` の操作系部品を実際に結線した見本です。

## 1. ⌘K コマンドパレット(`CommandMenu`)
`useKeyboardShortcuts` で `mod+k`(⌘K / Ctrl+K)を登録し、`CommandPalette` の開閉に結線。
`g h` / `g b` の連続入力でページ遷移も登録しています。
```tsx
<CommandMenu commands={SAMPLE_COMMANDS} onNavigate={(href) => router.push(href)} />
// ⌘K でパレット開閉、g h でダッシュボード、g b で予約一覧へ
```

## 2. 右クリック→コピー/貼り付け(`EditableCell`)
`ContextMenu` の項目に `useCopyToClipboard` / `usePaste` を結び、右クリックでコピー・貼り付け・クリア。
右クリックが使えない環境向けに `CopyButton` も併設しています。
```tsx
<EditableCell initial="編集可能なテキスト" />
// 右クリック → コピー / 貼り付け / クリア
```

## 使い分け
- グローバル操作(パレット・遷移)は `useKeyboardShortcuts`、コンテキスト操作は `ContextMenu`。
- 右クリックを禁止したい範囲は `useDisableContextMenu` を併用。
- コピペの実体は純ロジック `copyToClipboard` / `readClipboard`(writer/reader 注入でテスト可)。
