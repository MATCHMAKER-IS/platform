/**
 * **そのアプリがこのチェックアウトに存在するか**を判定する。
 *
 * 【なぜ要るか】
 * `.gitignore` が `apps/*` を除外している(ADR 0021)ため、
 * **どのアプリが手元にあるかは実行環境によって違う**:
 *
 * | 環境 | 存在するアプリ |
 * |---|---|
 * | 手元(基盤 + 自分のアプリ) | 最大 5 つ |
 * | **基盤の CI** | **showcase と crud-template だけ** |
 * | アプリ側リポジトリの CI | 基盤 + そのアプリ 1 つ |
 *
 * 2026-08 まで、`internal-auth.spec.ts` と `internal-equipment.spec.ts` は
 * **基盤の CI に存在しない `internal-app`(ポート 3000)を叩いていた**。
 * `continue-on-error: true` が付いていたため緑に見えており、
 * **誰も気づけない状態**だった。
 *
 * 【使い方】
 * ```ts
 * test.skip(!hasApp("internal-app"), "internal-app がこのチェックアウトにありません");
 * ```
 *
 * **`test.skip` にすること。** 削除すると、アプリのリポジトリ側で
 * 回したときにも走らなくなる——**そこでは実行してほしい**テストである。
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * アプリが存在するか。
 *
 * @param name アプリ名(`apps/` 直下のディレクトリ名)
 * @returns `apps/<名前>/package.json` があれば true
 */
export function hasApp(name: string): boolean {
  return existsSync(path.join(ROOT, "apps", name, "package.json"));
}

/** スキップ理由の定型文(メッセージを揃えて、ログから理由を追えるようにする)。 */
export function missingAppReason(name: string): string {
  return `${name} がこのチェックアウトにありません(ADR 0021 で apps/ は基盤の git 外)。このアプリのリポジトリの CI で実行されます`;
}
