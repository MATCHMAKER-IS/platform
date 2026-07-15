/**
 * `@platform/http` — HTTP 層の共通規約。
 * AppError → HTTP ステータス変換と、Route Handler / Result のレスポンス化。
 * @packageDocumentation
 */
export { STATUS_BY_CODE } from "./status.js";
export {
  toHttpError,
  handleRoute,
  resultToResponse,
  type HttpErrorBody,
} from "./handler.js";
