/**
 * zipcloud Adapter。認証不要・無料。日本郵便の郵便番号データを加工して提供。
 * ベース: https://zipcloud.ibsnet.co.jp/api/search
 * @packageDocumentation
 */
import { createApiClient } from "@platform/integrations";
import { AppError, ErrorCode, type Result } from "@platform/core";
import type { AddressAdapter, AddressResult } from "../index";

interface ZipcloudResult {
  zipcode: string;
  address1: string; // 都道府県
  address2: string; // 市区町村
  address3: string; // 町域
  kana1?: string;
  kana2?: string;
  kana3?: string;
}
interface ZipcloudResponse {
  status: number;
  message: string | null;
  results: ZipcloudResult[] | null;
}

/**
 * zipcloud Adapter を作る。
 * @returns {@link AddressAdapter} 実装
 */
export function createZipcloudAdapter(): AddressAdapter {
  const api = createApiClient({ baseUrl: "https://zipcloud.ibsnet.co.jp/api" });
  return {
    async lookup(zipcode: string): Promise<Result<AddressResult[]>> {
      const res = await api.get<ZipcloudResponse>("/search", { query: { zipcode } });
      if (!res.ok) return res;
      const body = res.value;
      if (body.status !== 200) {
        return { ok: false, error: new AppError(ErrorCode.EXTERNAL, body.message ?? "住所検索に失敗しました") };
      }
      const results = (body.results ?? []).map((r) => ({
        zipcode: r.zipcode,
        prefecture: r.address1,
        city: r.address2,
        town: r.address3,
        prefectureKana: r.kana1,
        cityKana: r.kana2,
        townKana: r.kana3,
      }));
      return { ok: true, value: results };
    },
  };
}
