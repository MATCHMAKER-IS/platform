/**
 * AI Gateway。アプリから AI プロバイダ(Anthropic / OpenAI 等)を直接呼ばず、**必ずここを経由する**。
 * Gateway が担うもの: モデル→プロバイダのルーティング / トークン上限の強制 / 予算(累積トークン)管理 /
 * コスト計算 / 呼び出しログ(プロンプトはマスク可) / フォールバック。
 * fetch は注入可能なので、実 API 無しで形状まで検証できる。開発ルール「AI API 直接利用の禁止」の受け皿。
 *
 * 【送る内容に注意】
 *
 * **プロンプトは社外へ出る。** ログのマスク(`redact`)はこちらの記録を守るだけで、
 * **プロバイダには元の文字列がそのまま届く**。次のものを混ぜないこと:
 *
 * - **個人情報** … 氏名・住所・マイナンバー・口座番号。
 *   要約や分類の材料にするなら、先に `@platform/pii` でマスクする。
 * - **社外秘** … 未公開の売上・原価・取引先との条件。
 * - **利用者が入力した文字列をそのまま** … 「以前の指示を無視して」と書けば
 *   **こちらのシステムプロンプトを上書きできる**(プロンプトインジェクション)。
 *   利用者の入力は**データとして扱う**——指示と混ぜず、区切って渡すこと。
 *
 * 送った内容が**学習に使われるか**はプロバイダと契約による。
 * 業務データを扱うなら、**学習に使わない契約**であることを確認すること(2026-08)。
 *
 * @packageDocumentation
 */
export * from "./types";
export * from "./log-store";
export * from "./gateway";
export * from "./providers";
export * from "./embedding";
export * from "./image";
export * from "./tokens";
export * from "./prompt";
export * from "./safety";
export * from "./governance";
export * from "./compliance";
export * from "./provenance";
export * from "./agent";
