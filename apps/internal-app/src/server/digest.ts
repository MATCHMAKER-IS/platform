/**
 * 通知ダイジェスト。通知プレファレンスの digest モードを、利用者ごとの頻度（毎日/毎週）でまとめて配信するためのロジック。純粋関数。
 * @packageDocumentation
 */

/** ダイジェスト頻度。 */
export type DigestFrequency = "daily" | "weekly" | "off";

/** 利用者ごとのダイジェスト設定。 */
export interface DigestSetting {
  frequency: DigestFrequency;
  lastSentAt?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** ダイジェスト配信が必要か（頻度に応じた間隔を超えていれば true。off や未到達は false）。 */
export function isDigestDue(setting: DigestSetting, now: Date): boolean {
  if (setting.frequency === "off") return false;
  if (!setting.lastSentAt) return true;
  const elapsed = now.getTime() - new Date(setting.lastSentAt).getTime();
  const interval = setting.frequency === "daily" ? DAY_MS : 7 * DAY_MS;
  return elapsed >= interval;
}

/** ダイジェストに含める項目。 */
export interface DigestItem {
  title: string;
  at: string;
  category?: string;
}

/** 項目からダイジェスト本文を組み立てる（新しい順・件数付き）。空なら null（送らない）。 */
export function buildDigestSummary(items: DigestItem[]): { subject: string; body: string } | null {
  if (items.length === 0) return null;
  const sorted = items.slice().sort((a, b) => (b.at < a.at ? -1 : b.at > a.at ? 1 : 0));
  const lines = sorted.map((i) => `・${i.at.slice(0, 16).replace("T", " ")} ${i.title}`);
  return {
    subject: `未読通知のまとめ（${items.length}件）`,
    body: `未読の通知が ${items.length} 件あります。\n\n${lines.join("\n")}`,
  };
}

/** 対象者のうちダイジェスト配信すべき人を返す。 */
export function usersDueForDigest(settings: { email: string; setting: DigestSetting }[], now: Date): string[] {
  return settings.filter((s) => isDigestDue(s.setting, now)).map((s) => s.email);
}

// ── ダイジェスト設定ストア（email→設定）──

/** ダイジェスト設定ストア。 */
export interface DigestSettingStore {
  get(email: string): Promise<DigestSetting>;
  set(email: string, setting: DigestSetting): Promise<void>;
  all(): Promise<{ email: string; setting: DigestSetting }[]>;
}

/** インメモリ実装。 */
export function createMemoryDigestSettingStore(): DigestSettingStore {
  const map = new Map<string, DigestSetting>();
  return {
    async get(email) {
      return map.get(email) ?? { frequency: "off" };
    },
    async set(email, setting) {
      map.set(email, setting);
    },
    async all() {
      return [...map.entries()].map(([email, setting]) => ({ email, setting }));
    },
  };
}

/** SettingRow の必要部分。 */
export interface DigestRow {
  key: string;
  value: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface DigestSettingStoreDb {
  settingRow: {
    findUnique(args: { where: { key: string } }): Promise<DigestRow | null>;
    upsert(args: { where: { key: string }; create: DigestRow; update: { value: string } }): Promise<DigestRow>;
  };
}

const DIGEST_KEY = "digestSettings";

/** Prisma 実装（単一 SettingRow に email→設定の JSON を格納）。 */
export function createPrismaDigestSettingStore(db: DigestSettingStoreDb): DigestSettingStore {
  async function readAll(): Promise<Record<string, DigestSetting>> {
    const row = await db.settingRow.findUnique({ where: { key: DIGEST_KEY } });
    if (!row) return {};
    try {
      return JSON.parse(row.value) as Record<string, DigestSetting>;
    } catch {
      return {};
    }
  }
  return {
    async get(email) {
      return (await readAll())[email] ?? { frequency: "off" };
    },
    async set(email, setting) {
      const map = await readAll();
      map[email] = setting;
      const value = JSON.stringify(map);
      await db.settingRow.upsert({ where: { key: DIGEST_KEY }, create: { key: DIGEST_KEY, value }, update: { value } });
    },
    async all() {
      return Object.entries(await readAll()).map(([email, setting]) => ({ email, setting }));
    },
  };
}
