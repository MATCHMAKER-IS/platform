/**
 * LINE の基本的な型。
 *
 * **依存を持ちません。** `messages.ts` がここから型を取ることで、
 * **束ねた入口（`index.ts`）を経由せずに済みます**——
 * 入口は署名検証を通じて `node:crypto` に届くためです。
 *
 * @packageDocumentation
 */

/** LINE のメッセージ（型は緩い。ベンダーの形に合わせる）。 */
export interface LineMessage {
  type: "text" | "sticker" | "image" | "flex" | string;
  [key: string]: unknown;
}
