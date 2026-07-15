/**
 * 型付きジョブ定義。キュー名・ペイロード型・既定オプションを 1 か所に束ね、
 * enqueue と worker で型を共有する。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";

/** enqueue 可能な最小キュー。 */
interface Enqueueable<T> {
  add(name: string, data: T, options?: unknown): Promise<Result<void>>;
}

/** ジョブ定義。 */
export interface JobDefinition<T> {
  /** ジョブ名。 */
  readonly name: string;
  /** 指定キューに投入する(型は T に固定)。 */
  enqueue(queue: Enqueueable<T>, data: T, options?: unknown): Promise<Result<void>>;
}

/**
 * 型付きジョブを定義する。
 * @example
 * ```ts
 * const SendWelcome = defineJob<{ userId: string }>("send-welcome");
 * await SendWelcome.enqueue(queue, { userId });   // 型安全
 * ```
 */
export function defineJob<T>(name: string): JobDefinition<T> {
  return {
    name,
    enqueue: (queue, data, options) => queue.add(name, data, options),
  };
}
