/**
 * メンテナンス状態の永続ストア(DB backed)。
 * 基盤 `@platform/status-page` の {@link MaintenanceStore} を SystemSetting テーブルで実装する。
 * 管理画面 API から書き換え、middleware が(TTL キャッシュ越しに)読む。
 */
import type { MaintenanceState, MaintenanceStore } from "@platform/status-page";
import { db } from "./services";

const KEY = "maintenance";
const DEFAULT_STATE: MaintenanceState = { enabled: false };

/** DB を情報源とするメンテナンスストアを作る。 */
export function createDbMaintenanceStore(): MaintenanceStore {
  return {
    async get(): Promise<MaintenanceState> {
      const row = await db.systemSetting.findUnique({ where: { key: KEY } });
      if (!row) return DEFAULT_STATE;
      return { ...DEFAULT_STATE, ...(row.value as MaintenanceState) };
    },
    async set(state: MaintenanceState): Promise<void> {
      const value = { ...state, updatedAt: new Date().toISOString() };
      await db.systemSetting.upsert({
        where: { key: KEY },
        create: { key: KEY, value, updatedBy: state.updatedBy ?? null },
        update: { value, updatedBy: state.updatedBy ?? null },
      });
    },
  };
}
