# @demos/form-flow — 入力→確認→完了フォームの完成テンプレート

`@platform/form` の段階管理と `@platform/ui` の入力部品を束ねた 3 段階フォーム `ContactForm`。

## 構成
| 役割 | 部品 |
| --- | --- |
| 段階管理(入力/確認/完了) | `@platform/form` の `useSubmitFlow`(toConfirm/toEdit/submit/reset) |
| 確認画面の項目整形 | `@platform/form` の `reviewItems`(値を表示用文字列に) |
| ステップ表示 | `@platform/ui` の `Steps`(`SUBMIT_PHASES` / `phaseIndex`) |
| 入力・確認・ボタン | `@platform/ui` の `Input` / `Textarea` / `DescriptionList` / `Button` |

## 流れ
1. **入力** — フォームに入力し「確認画面へ」で `flow.toConfirm(values)`。
2. **確認** — `reviewItems` で整形した入力値を `DescriptionList` で表示。「修正する」= `flow.toEdit()`、
   「送信する」= `flow.submit(onSubmit)`。送信中はボタン無効、失敗すれば確認画面に留まりエラー表示。
3. **完了** — 完了メッセージ。「新しい問い合わせ」で `flow.reset()`。

送信ロジック(API 呼び出し)は `onSubmit` として渡します。バリデーションは `@platform/validation`、
公開サイトの問い合わせなら `@platform/site` のページに組み込みます。
