/**
 * フィーチャーフラグ。段階的ロールアウト（割合）・A/Bテスト（バリアント）・緊急停止（キルスイッチ）を実現する。
 * 評価は @platform/flags を利用。役割別の機能アクセス制御（feature-access）とは別軸の「実験・出し分け」用。
 * @packageDocumentation
 */
import { createFlags, createStaticProvider, type FlagDefinitions, type FlagContext, type Flags } from "@platform/flags";

/** 既定のフラグ定義（例）。運用では設定ストアで上書きする。 */
export const DEFAULT_FLAGS: FlagDefinitions = {
  newDashboard: { enabled: true, rolloutPercent: 20 },
  betaSurveyUi: { enabled: false },
};

/** フラグ定義から評価器を作る。 */
export function createAppFlags(defs: FlagDefinitions): Flags {
  return createFlags(createStaticProvider(defs));
}

/** ユーザーから評価コンテキストを作る（key=安定識別子、role をターゲティング属性に）。 */
export function flagContext(user: { email: string; roles: string[] }): FlagContext {
  return { key: user.email, attributes: { role: user.roles[0] ?? "employee", roles: user.roles } };
}

/** フラグ定義ストア。 */
export interface FlagStore {
  get(): Promise<FlagDefinitions>;
  update(defs: FlagDefinitions): Promise<FlagDefinitions>;
}

/** インメモリ実装。 */
export function createMemoryFlagStore(initial: FlagDefinitions = DEFAULT_FLAGS): FlagStore {
  let defs: FlagDefinitions = { ...initial };
  return {
    async get() {
      return { ...defs };
    },
    async update(next) {
      defs = { ...next };
      return { ...defs };
    },
  };
}

// ── Prisma 実装（SettingRow に JSON 保存）──

/** SettingRow の必要部分。 */
export interface FlagRow {
  key: string;
  value: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface FlagStoreDb {
  settingRow: {
    findUnique(args: { where: { key: string } }): Promise<FlagRow | null>;
    upsert(args: { where: { key: string }; create: FlagRow; update: { value: string } }): Promise<FlagRow>;
  };
}

const SETTING_KEY = "featureFlags";

/** Prisma 実装。 */
export function createPrismaFlagStore(db: FlagStoreDb): FlagStore {
  return {
    async get() {
      const row = await db.settingRow.findUnique({ where: { key: SETTING_KEY } });
      if (!row) return { ...DEFAULT_FLAGS };
      try {
        return JSON.parse(row.value) as FlagDefinitions;
      } catch {
        return { ...DEFAULT_FLAGS };
      }
    },
    async update(defs) {
      const value = JSON.stringify(defs);
      await db.settingRow.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value }, update: { value } });
      return { ...defs };
    },
  };
}
