/**
 * `@platform/faker` — 日本語のダミーデータ生成。
 *
 * 開発用シードデータ・デモ・負荷試験のための「それらしい」日本語データを作る。
 * 内部実装は @faker-js/faker(ja ロケール)。テストの固定値は `@platform/testing`
 * のファクトリを使い、こちらは「量産する現実的なダミー」に使う。
 *
 * 【使ってはいけないところ】
 *
 * - **本番データの穴埋め。** それらしく見えるので**気づかれずに残る**。
 *   氏名や住所が架空のまま請求書や帳票に載り、送付先が存在しない住所になる。
 *   欠損は空のままにして、画面で「未入力」と分かる形にすること。
 * - **秘密の生成。** `email()` などは**予測可能な擬似乱数**で、
 *   `setSeed` を使えば同じ値が再現できる。トークン・パスワード・鍵には
 *   `@platform/crypto` の `randomToken()` / `generatePassword()` を使う。
 * - **マスキング(匿名化)。** 本物を faker の値で置き換えても、
 *   **対応表が残っていれば戻せる**し、件数や分布から個人が特定されうる。
 *   個人情報の扱いは `@platform/pii` を使うこと。
 *
 * この 3 つはどれも「動いてしまう」ので、検査では止まらない。
 *
 * @packageDocumentation
 */

import { fakerJA as faker } from "@faker-js/faker";

/**
 * 乱数シードを固定する(再現可能なダミーデータを作りたいとき)。
 *
 * @param seed 乱数の種(**同じ種なら同じデータ**。テストを再現できる)
 */
export function setSeed(seed: number): void {
  faker.seed(seed);
}

/**
 * 日本語の氏名(姓名)。
 *
 * @returns 日本人の氏名(**姓と名を組み合わせる**)
 */
export function japaneseName(): string {
  return faker.person.fullName();
}

/**
 * 会社名。
 *
 * @returns 会社名(**架空**。実在の企業名は出ない)
 */
export function companyName(): string {
  return faker.company.name();
}

/**
 * メールアドレス。
 *
 * @returns メールアドレス(**`example.com` などの予約ドメイン**を使う。実在のアドレスに送らないため)
 */
export function email(): string {
  return faker.internet.email();
}

/**
 * 日本の電話番号(ハイフン付き)。
 *
 * @returns 電話番号(**070-0000-0000 形式の架空番号**)
 */
export function phoneNumber(): string {
  return faker.phone.number({ style: "national" });
}

/**
 * 日本の住所(都道府県〜番地)。
 *
 * @returns 住所(架空)
 */
export function address(): string {
  return `${faker.location.state()}${faker.location.city()}${faker.location.streetAddress()}`;
}

/**
 * 郵便番号(123-4567 形式)。
 *
 * @returns 郵便番号
 */
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
