/**
 * ユーザー・権限ディレクトリ（管理画面）。利用者・部門・ロール・追加権限を管理し、パスワード再発行にも対応する。
 * 認可のロール／権限はここで管理する想定（実際の認証連携はログイン基盤側）。
 * @packageDocumentation
 */
import type { BackupCodeRecord } from "@platform/auth";


/** 割り当て可能なロール。 */
export const ASSIGNABLE_ROLES = ["employee", "editor", "manager", "finance", "admin"] as const;
export type Role = (typeof ASSIGNABLE_ROLES)[number];

/** 利用者。 */
export interface User {
  email: string;
  name: string;
  /** 所属部門。 */
  department: string;
  roles: Role[];
  /** ロールに加えて個別付与する権限。 */
  permissions: string[];
  active: boolean;
  createdAt: string;
  /** パスワード最終設定日時（未設定なら undefined）。 */
  passwordSetAt?: string;
  /** `upsert` 時だけ含まれる、ロールの差分(追加/削除)。
   *  「誰がいつ何の権限を付けたか」を監査ログに残すために使う。 */
  roleChanges?: { added: string[]; removed: string[] };
}

/** 登録・更新の入力。 */
export interface UserInput {
  email: string;
  name: string;
  department?: string;
  roles: string[];
  /**
   * **誰がこの変更をしたか**（任意）。
   *
   * **いまは使っていません**（記録は呼び出し側で行います）——
   * **将来この層で記録するときのために**残してあります。
   */
  actor?: string;
  permissions?: string[];
  active?: boolean;
}

/** 未知のロールを弾いて正規化する（重複排除・定義順）。 */
export function normalizeRoles(roles: string[]): Role[] {
  const set = new Set(roles.filter((r): r is Role => (ASSIGNABLE_ROLES as readonly string[]).includes(r)));
  return ASSIGNABLE_ROLES.filter((r) => set.has(r));
}

const dedupe = (xs: string[]): string[] => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

/** 内部保持レコード（パスワードハッシュを含む）。 */
interface UserRecord extends User {
  passwordHash?: string;
  /** TOTP のシークレット(base32)。未設定なら 2 要素認証を使っていない。 */
  totpSecret?: string;
  /** TOTP を有効にした時刻。 */
  totpEnabledAt?: string;
  /** セッションを無効にした時刻。 */
  sessionsRevokedAt?: string;
  /** 予備コード(ハッシュ)。 */
  backupCodes?: BackupCodeRecord[];
}

const publicUser = (r: UserRecord): User => {
  const { passwordHash: _omit, ...u } = r;
  return { ...u, roles: [...u.roles], permissions: [...u.permissions] };
};

/** ユーザーストア。 */
export interface UserStore {
  list(): Promise<User[]>;
  get(email: string): Promise<User | undefined>;
  upsert(input: UserInput): Promise<User>;
  setActive(email: string, active: boolean): Promise<void>;
  /**
   * 発行済みのセッションを一斉に無効にする。
   *
   * **退職・異動では権限を消すだけでは足りない**(ADR-0017)。
   * セッションが生きていれば、その中身(ロール)で操作が通る。
   */
  revokeSessions(email: string): Promise<void>;
  /** セッションを無効にした時刻(照合用)。 */
  getSessionsRevokedAt(email: string): Promise<string | undefined>;
  /** パスワードハッシュを設定する（再発行）。 */
  setPassword(email: string, passwordHash: string): Promise<void>;
  /**
   * **照合用に**ハッシュを取り出す。
   *
   * `get` はハッシュを落として返す(画面や API に漏らさないため)。
   * ログインの照合だけはハッシュが要るので、専用の口を分けてある。
   * **この戻り値を画面へ渡さないこと。**
   */
  getPasswordHash(email: string): Promise<string | undefined>;
  /**
   * TOTP のシークレットを取り出す(**照合用**)。
   *
   * `get` は返さない(画面や API に漏らさないため)。
   * 未設定なら `undefined` = 2 要素認証を使っていない。
   */
  getTotpSecret(email: string): Promise<string | undefined>;
  /**
   * 2 要素認証の設定を読む(**照合用**)。
   *
   * `get` は返さない(シークレットも予備コードも画面へ出さない)。
   */
  getTwoFactor(email: string): Promise<{ totpSecret?: string; backupCodes: BackupCodeRecord[] }>;
  /**
   * **有効化前の**シークレットを取り出す。
   *
   * `getTwoFactor` は有効化済みのものしか返さない(未完了の登録で
   * 締め出さないため)。有効化の確認だけはこちらを使う。
   */
  getPendingTotpSecret(email: string): Promise<string | undefined>;
  /**
   * 2 要素認証の設定を書く。
   *
   * `totpSecret` に `null` を渡すと解除、`undefined` なら据え置き。
   */
  setTwoFactor(email: string, input: {
    totpSecret?: string | null;
    enabled?: boolean;
    backupCodes?: BackupCodeRecord[];
  }): Promise<void>;
}

/** インメモリ実装。 */
export function createMemoryUserStore(seed: User[] = []): UserStore {
  const byEmail = new Map<string, UserRecord>(seed.map((u) => [u.email, { ...u, roles: [...u.roles], permissions: [...(u.permissions ?? [])] }]));
  return {
    async list() {
      return [...byEmail.values()].map(publicUser).sort((a, b) => (a.email < b.email ? -1 : 1));
    },
    async get(email) {
      const u = byEmail.get(email);
      return u ? publicUser(u) : undefined;
    },
    async upsert(input) {
      const existing = byEmail.get(input.email);
      const rec: UserRecord = {
        email: input.email,
        name: input.name,
        department: input.department ?? existing?.department ?? "",
        roles: normalizeRoles(input.roles),
        permissions: dedupe(input.permissions ?? existing?.permissions ?? []),
        active: input.active ?? existing?.active ?? true,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        ...(existing?.passwordSetAt ? { passwordSetAt: existing.passwordSetAt } : {}),
        ...(existing?.passwordHash ? { passwordHash: existing.passwordHash } : {}),
      };
      byEmail.set(input.email, rec);

      // **Prisma 実装と同じ形で差分を返す。**
      // **片方だけ返すと、試験では通るのに本番で `undefined`**
      // ——**その逆もあり、どちらも気づきにくい**失敗です。
      const before = existing?.roles ?? [];
      const after = rec.roles;
      return {
        ...publicUser(rec),
        roleChanges: {
          added: after.filter((r) => !before.includes(r)),
          removed: before.filter((r) => !after.includes(r)),
        },
      };
    },
    async setActive(email, active) {
      const u = byEmail.get(email);
      if (u) u.active = active;
    },
    async getPasswordHash(email) {
      return byEmail.get(email)?.passwordHash;
    },
    async getTotpSecret(email) {
      return byEmail.get(email)?.totpSecret;
    },
    async revokeSessions(email) {
      const u = byEmail.get(email);
      if (u) u.sessionsRevokedAt = new Date().toISOString();
    },
    async getSessionsRevokedAt(email) {
      return byEmail.get(email)?.sessionsRevokedAt;
    },
    async getPendingTotpSecret(email) {
      return byEmail.get(email)?.totpSecret;
    },
    async getTwoFactor(email) {
      const u = byEmail.get(email);
      return {
        ...(u?.totpEnabledAt !== undefined && u.totpSecret !== undefined
          ? { totpSecret: u.totpSecret } : {}),
        backupCodes: u?.backupCodes ?? [],
      };
    },
    async setTwoFactor(email, input) {
      const u = byEmail.get(email);
      if (!u) return;
      if (input.totpSecret === null) { delete u.totpSecret; delete u.totpEnabledAt; }
      else if (input.totpSecret !== undefined) u.totpSecret = input.totpSecret;
      if (input.enabled === true) u.totpEnabledAt = new Date().toISOString();
      if (input.backupCodes !== undefined) u.backupCodes = input.backupCodes;
    },
    async setPassword(email, passwordHash) {
      const u = byEmail.get(email);
      if (u) { u.passwordHash = passwordHash; u.passwordSetAt = new Date().toISOString(); }
    },
  };
}

// ── Prisma 実装 ──

/** UserRow の必要部分（roles・permissions は CSV 保存）。 */
export interface UserRow {
  email: string;
  name: string;
  department: string;
  roles: string;
  permissions: string;
  active: boolean;
  /** DB では `Date`。`User` の公開契約(`createdAt: string`)は変えない
   *  ——`rowToUser` の境界で変換する(2026-08)。 */
  createdAt: Date;
  passwordHash: string | null;
  /** DB では `Date | null`。公開契約(`passwordSetAt?: string`)は変えない
   *  ——境界で変換する(2026-08)。 */
  passwordSetAt: Date | null;
  totpSecret: string | null;
  /** DB では `Date | null`。境界で変換する(2026-08)。 */
  totpEnabledAt: Date | null;
  backupCodes: unknown;
  /** DB では `Date | null`。境界で変換する(2026-08)。 */
  sessionsRevokedAt: Date | null;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface UserStoreDb {
  userRow: {
    findMany(args: { orderBy: { email: "asc" } }): Promise<UserRow[]>;
    findUnique(args: { where: { email: string } }): Promise<UserRow | null>;
    // **`create` は `UserRow` 全体を要求しない。** `totpSecret` 等は
    // すべて `String?`(既定 null)——呼び出し側が毎回全フィールドを
    // 埋める必要は無い。以前は `create: UserRow`(全必須)という型で、
    // 実際の呼び出しが一部を省略しても実行時は動く(Prisma が null で
    // 埋める)分、型が実態を正しく表していなかった(2026-08、createdAt を
    // Date にしたときに顕在化して発見)。
    upsert(args: { where: { email: string }; create: Omit<UserRow, "totpSecret" | "totpEnabledAt" | "backupCodes" | "sessionsRevokedAt">; update: { name: string; department: string; roles: string; permissions: string; active: boolean } }): Promise<UserRow>;
    // **`sessionsRevokedAt` が型に無かった。** `revokeSessions` が
    // 実際に渡しているのに、型定義には含まれていなかった
    // (2026-08、createdAt を Date にしたときに他のフィールドも
    // 見直して発見)。
    update(args: { where: { email: string }; data: { active?: boolean; passwordHash?: string; passwordSetAt?: Date; sessionsRevokedAt?: Date } }): Promise<UserRow>;
  };
}

function rowToUser(row: UserRow): User {
  return {
    email: row.email,
    name: row.name,
    department: row.department ?? "",
    roles: normalizeRoles(row.roles ? row.roles.split(",") : []),
    permissions: dedupe(row.permissions ? row.permissions.split(",") : []),
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    ...(row.passwordSetAt ? { passwordSetAt: row.passwordSetAt.toISOString() } : {}),
  };
}

/** Prisma 実装。 */
export function createPrismaUserStore(db: UserStoreDb): UserStore {
  return {
    async list() {
      return (await db.userRow.findMany({ orderBy: { email: "asc" } })).map(rowToUser);
    },
    async get(email) {
      const row = await db.userRow.findUnique({ where: { email } });
      return row ? rowToUser(row) : undefined;
    },
    async upsert(input) {
      const roles = normalizeRoles(input.roles).join(",");
      const permissions = dedupe(input.permissions ?? []).join(",");
      const existing = await db.userRow.findUnique({ where: { email: input.email } });
      const createdAt = existing?.createdAt ?? new Date();
      const active = input.active ?? existing?.active ?? true;
      const department = input.department ?? existing?.department ?? "";
      // **権限が変わったら記録する。**
      //
      // 【なぜ要るか】
      // **`roles` は上書きされるので、何がいつ足されたか残りません。**
      // 権限の棚卸し（`/admin/access-review`）で「いつ付いたか」を見たいとき、
      // **利用者の作成日で代用するしかありませんでした**——
      // **後から足された権限も「入社時から」に見えます**。
      //
      // 【差分だけを残します】
      // 変わっていない権限は記録しません——**全部残すと差分が埋もれます**。
      const before = existing === null
        ? []
        : existing.roles.split(",").map((r) => r.trim()).filter((r) => r !== "");
      const after = roles.split(",").map((r) => r.trim()).filter((r) => r !== "");
      const added = after.filter((r) => !before.includes(r));
      const removed = before.filter((r) => !after.includes(r));

      const row = await db.userRow.upsert({
        where: { email: input.email },
        create: { email: input.email, name: input.name, department, roles, permissions, active, createdAt, passwordHash: existing?.passwordHash ?? null, passwordSetAt: existing?.passwordSetAt ?? null },
        update: { name: input.name, department, roles, permissions, active },
      });

      // **強い権限が付いたことは、必ず残します。**
      // 「誰がいつ管理者権限を付けたか」が分からないと、
      // **後から「聞いていない」と言われたときに確かめられません**。
      // **記録はここではしません。** この層に監査ログを繋ぐと、
      // **`@platform/db` への依存が増えて、試験で差し替える範囲が広がります**。
      //
      // **差分を返すので、呼び出し側（API）で記録**してください——
      // **誰が操作したかは、そちらの方が確かに分かります**。
      return { ...rowToUser(row), roleChanges: { added, removed } };
    },
    async setActive(email, active) {
      await db.userRow.update({ where: { email }, data: { active } });
    },
    async getPasswordHash(email) {
      const row = await db.userRow.findUnique({ where: { email } });
      return row?.passwordHash ?? undefined;
    },
    async revokeSessions(email) {
      await db.userRow.update({
        where: { email }, data: { sessionsRevokedAt: new Date() },
      });
    },
    async getSessionsRevokedAt(email) {
      const row = await db.userRow.findUnique({ where: { email } });
      return row?.sessionsRevokedAt ? row.sessionsRevokedAt.toISOString() : undefined;
    },
    async getPendingTotpSecret(email) {
      const row = await db.userRow.findUnique({ where: { email } });
      return row?.totpSecret ?? undefined;
    },
    async getTwoFactor(email) {
      const row = await db.userRow.findUnique({ where: { email } });
      const enabled = row?.totpEnabledAt !== null && row?.totpEnabledAt !== undefined;
      return {
        ...(enabled && row?.totpSecret ? { totpSecret: row.totpSecret } : {}),
        backupCodes: Array.isArray(row?.backupCodes) ? (row.backupCodes as BackupCodeRecord[]) : [],
      };
    },
    async setTwoFactor(email, input) {
      const data: Record<string, unknown> = {};
      if (input.totpSecret === null) { data["totpSecret"] = null; data["totpEnabledAt"] = null; }
      else if (input.totpSecret !== undefined) data["totpSecret"] = input.totpSecret;
      if (input.enabled === true) data["totpEnabledAt"] = new Date();
      if (input.backupCodes !== undefined) data["backupCodes"] = input.backupCodes;
      if (Object.keys(data).length === 0) return;
      await db.userRow.update({ where: { email }, data });
    },
    async getTotpSecret(email) {
      const row = await db.userRow.findUnique({ where: { email } });
      // **有効化まで済んだものだけ。** 登録の途中で放置されたシークレットで
      // 締め出さない(設定画面で確認コードを入れて初めて有効になる)
      return row?.totpEnabledAt !== null && row?.totpEnabledAt !== undefined
        ? (row.totpSecret ?? undefined) : undefined;
    },
    async setPassword(email, passwordHash) {
      await db.userRow.update({ where: { email }, data: { passwordHash, passwordSetAt: new Date() } });
    },
  };
}
