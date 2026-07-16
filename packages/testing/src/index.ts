/**
 * `@platform/testing` — テスト支援ツール。
 *
 * - ファクトリ: ダミーのユーザー・セッション・ID・日時を一貫して生成。
 * - 契約テスト: アダプタ実装(Cache/Storage 等)が満たすべき振る舞いを共通化し、
 *   実装差による属人的なバグを防ぐ。
 *
 * @packageDocumentation
 */
export { testId, fakeAuthUser, fakeSession, fixedDate } from "./factories";
export { runCacheContract } from "./contracts/cache";
export { runStorageContract } from "./contracts/storage";
