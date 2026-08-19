/**
 * `@platform/http` — HTTP 層の共通規約。
 * AppError → HTTP ステータス変換と、Route Handler / Result のレスポンス化。
 * @packageDocumentation
 */
export { STATUS_BY_CODE } from "./status";
export {
  toHttpError,
  handleRoute,
  resultToResponse,
  type HttpErrorBody,
} from "./handler";
export * from "./paging";
export {
  toUserMessage, toUserText, toUserMessageFor, type UserMessage,
} from "./user-message";

/**
 * 条件付きリクエスト・冪等キー・再試行の案内。
 *
 * **どのアプリでも同じように要る**もので、
 * **間違えると分かりにくい形で壊れる**(二重登録・全件送信)。
 */
export {
  makeETag, notModified,
  createMemoryIdempotencyStore, withIdempotency,
  tooManyRequests, serviceUnavailable,
  type IdempotencyStore, type IdempotencyOptions,
} from "./conditional";
