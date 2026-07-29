/**
 * 環境変数の検証（起動時に落とす）。
 *
 * **鍵が無いまま起動すると、使う段になって初めて失敗します。**
 * ここで確かめておけば、起動した時点で設定漏れが分かります。
 * @packageDocumentation
 */
import { parseEnv, z } from "@platform/env";

export const env = parseEnv(
  z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /** 記録の保存先。**未設定だとメモリになり、再起動で消えます。** */
    DATABASE_URL: z.string().url().optional().describe("接続先 PostgreSQL（記録を残すなら必須）"),
    /** freee のアプリ情報。未設定なら見本データで動く。 */
    FREEE_CLIENT_ID: z.string().optional().describe("freee アプリのクライアント ID"),
    FREEE_CLIENT_SECRET: z.string().optional().describe("freee アプリのシークレット"),
    FREEE_REFRESH_TOKEN: z.string().optional().describe("freee のリフレッシュトークン（回転する）"),
    /** 事業所 ID。freee で複数の事業所を扱う場合に必要。 */
    FREEE_COMPANY_ID: z.coerce.number().optional().describe("freee の事業所 ID"),
    /** 定期実行の入口を守る鍵。**未設定なら実行できない**（開けっ放しにしない）。 */
    COLLECT_SECRET: z.string().min(16).optional().describe("定期取得を叩くための共有鍵（16文字以上）"),
  }),
  process.env,
);

/**
 * freee に繋げる状態か。
 *
 * **繋がらないときは見本データで動かします。** 鍵が無いと画面が真っ白になり、
 * 「壊れているのか設定が足りないのか」が分からなくなるためです。
 */
export const canUseFreee = Boolean(
  env.FREEE_CLIENT_ID && env.FREEE_CLIENT_SECRET && env.FREEE_REFRESH_TOKEN && env.FREEE_COMPANY_ID,
);
