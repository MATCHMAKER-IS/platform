/**
 * `@platform/address` — 郵便番号から住所を逆引きする共通部品(Adapter パターン)。
 *
 * データ源(zipcloud / 日本郵便公式 等)を差し替え可能。既定は認証不要の zipcloud。
 * 検証ではなく外部データ参照なので validation とは分離している。
 *
 * @packageDocumentation
 */

import type { Result } from "@platform/core";

/** 逆引き結果の住所。 */
export interface AddressResult {
  /** 郵便番号(ハイフンなし 7 桁)。 */
  zipcode: string;
  /** 都道府県。 */
  prefecture: string;
  /** 市区町村。 */
  city: string;
  /** 町域。 */
  town: string;
  /** 都道府県カナ。 */
  prefectureKana?: string;
  /** 市区町村カナ。 */
  cityKana?: string;
  /** 町域カナ。 */
  townKana?: string;
}

/** 住所データ源の抽象(Adapter)。 */
export interface AddressAdapter {
  lookup(zipcode: string): Promise<Result<AddressResult[]>>;
}

/** アプリが使う住所逆引き口。 */
export interface AddressLookup {
  /**
   * 郵便番号から住所候補を取得する(1 郵便番号に複数町域が対応する場合がある)。
   * 入力はハイフン・全角数字が混在してもよい(内部で正規化)。
   * @param zipcode 郵便番号
   * @returns 住所候補の配列(該当なしは空配列)の `ok`、通信失敗は `err`
   */
  lookup(zipcode: string): Promise<Result<AddressResult[]>>;
}

/** 郵便番号を半角数字 7 桁に正規化する(全角→半角、ハイフン・空白除去)。 */
export function normalizeZipcode(input: string): string {
  return input
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, "");
}

/**
 * Adapter を注入して住所逆引きを作る。
 * @param adapter {@link createZipcloudAdapter} 等
 * @returns {@link AddressLookup}
 *
 * @example
 * ```ts
 * const address = createAddressLookup(createZipcloudAdapter());
 * const res = await address.lookup("100-0001");
 * if (res.ok && res.value[0]) console.log(res.value[0].prefecture); // 東京都
 * ```
 */
export function createAddressLookup(adapter: AddressAdapter): AddressLookup {
  return {
    lookup: (zipcode) => adapter.lookup(normalizeZipcode(zipcode)),
  };
}

export { createZipcloudAdapter } from "./adapters/zipcloud";
