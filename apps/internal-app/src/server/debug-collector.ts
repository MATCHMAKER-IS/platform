/**
 * Platform Debugger の収集器(アプリで 1 つだけ)。
 *
 * **本番では無効**(`featureEnv.DEBUG_TOOL` は NODE_ENV=production のとき強制的に false)。
 * 無効時は記録も保持もしないため、メモリ・性能への影響はない。
 *
 * 有効にするには開発環境で `.env` に `DEBUG_TOOL=true` を設定して再起動。
 * 画面: /debug
 * @packageDocumentation
 */
import { createDebugCollector } from "@platform/debug";
import { featureEnv } from "./env";

/**
 * このアプリの Platform Debugger。
 *
 * `@platform/debug` の `createDebugCollector` で作った**インスタンス**
 * (基盤の実装を使う)。保持件数やしきい値はアプリごとに変えるため、ここで組み立てる。
 */
export const debugCollector = createDebugCollector({
  enabled: featureEnv.DEBUG_TOOL,
  capacity: 50,
  slowSqlMs: 100,
});
