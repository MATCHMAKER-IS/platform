/**
 * 初期セットアップ（オンボーディング）。管理者不在なら初回セットアップを促し、最初の管理者作成・初期設定・初期データ投入を管理する。純ロジック。
 * @packageDocumentation
 */

/** セットアップに必要な現状の集計。 */
export interface SetupCounts {
  userCount: number;
  adminCount: number;
  companyNameSet: boolean;
}

/** 各ステップの完了状況。 */
export interface SetupState {
  /** 初期化済みか（管理者が1人以上いる）。 */
  initialized: boolean;
  steps: {
    admin: boolean;
    company: boolean;
  };
  /** 最初の管理者を作成してよいか（まだ管理者がいない場合のみ）。 */
  canCreateFirstAdmin: boolean;
}

/** 現状からセットアップ状態を判定する。 */
export function setupState(counts: SetupCounts): SetupState {
  const admin = counts.adminCount > 0;
  return {
    initialized: admin,
    steps: { admin, company: counts.companyNameSet },
    canCreateFirstAdmin: counts.adminCount === 0,
  };
}

/** 初回セットアップが必要か。 */
export function needsSetup(counts: SetupCounts): boolean {
  return counts.adminCount === 0;
}

/** 最初の管理者作成が許可されるか（既に管理者がいれば禁止＝乗っ取り防止）。 */
export function canBootstrapAdmin(adminCount: number): boolean {
  return adminCount === 0;
}

/** 初期投入する既定データ（例：既定のアンケートカテゴリや初期設定値）。 */
export interface SeedPlan {
  settings: { companyName: string; fiscalClosingMonth: number; consumptionTaxRate: number };
}

/** 会社名から初期設定の投入計画を作る。 */
export function defaultSeedPlan(companyName: string): SeedPlan {
  return { settings: { companyName, fiscalClosingMonth: 3, consumptionTaxRate: 10 } };
}
