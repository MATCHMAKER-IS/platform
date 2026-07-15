/**
 * `@platform/faker` — 日本語のダミーデータ生成。
 *
 * 開発用シードデータ・デモ・負荷試験のための「それらしい」日本語データを作る。
 * 内部実装は @faker-js/faker(ja ロケール)。テストの固定値は `@platform/testing`
 * のファクトリを使い、こちらは「量産する現実的なダミー」に使う。
 *
 * @packageDocumentation
 */

import { fakerJA as faker } from "@faker-js/faker";

/** 乱数シードを固定する(再現可能なダミーデータを作りたいとき)。 */
export function setSeed(seed: number): void {
  faker.seed(seed);
}

/** 日本語の氏名(姓名)。 */
export function japaneseName(): string {
  return faker.person.fullName();
}

/** 会社名。 */
export function companyName(): string {
  return faker.company.name();
}

/** メールアドレス。 */
export function email(): string {
  return faker.internet.email();
}

/** 日本の電話番号(ハイフン付き)。 */
export function phoneNumber(): string {
  return faker.phone.number({ style: "national" });
}

/** 日本の住所(都道府県〜番地)。 */
export function address(): string {
  return `${faker.location.state()}${faker.location.city()}${faker.location.streetAddress()}`;
}

/** 郵便番号(123-4567 形式)。 */
export function zipCode(): string {
  return faker.location.zipCode("###-####");
}

/**
 * ファクトリ関数で n 件のダミーを量産する。
 * @typeParam T 生成する型
 * @param n     件数
 * @param factory 1 件を生成する関数(index を受け取る)
 * @returns 生成した配列
 *
 * @example
 * ```ts
 * const users = seedMany(100, () => ({ name: japaneseName(), email: email() }));
 * ```
 */
export function seedMany<T>(n: number, factory: (index: number) => T): T[] {
  return Array.from({ length: n }, (_v, i) => factory(i));
}

/** 生の faker(ja)インスタンス。上記に無い生成が必要なとき用。 */
export { faker };
