/**
 * アプリ共有の相関コンテキスト。API 計装が traceId/requestId を束ね、全ログへ自動付与する。
 * @packageDocumentation
 */
import { createContextStore } from "@platform/logger";

/** アプリ全体で共有する相関コンテキスト。 */
export const logContext = createContextStore();
