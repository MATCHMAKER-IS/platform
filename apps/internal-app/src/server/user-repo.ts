/**
 * ユーザー・権限ディレクトリ（管理画面）。利用者・部門・ロール・追加権限を管理し、パスワード再発行にも対応する。
 * 認可のロール／権限はここで管理する想定（実際の認証連携はログイン基盤側）。
 * @packageDocumentation
 */

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
}

/** 登録・更新の入力。 */
export interface UserInput {
  email: string;
  name: string;
  department?: string;
  roles: string[];
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
  /** パスワードハッシュを設定する（再発行）。 */
  setPassword(email: string, passwordHash: string): Promise<void>;
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
      return publicUser(rec);
    },
    async setActive(email, active) {
      const u = byEmail.get(email);
      if (u) u.active = active;
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
  createdAt: string;
  passwordHash: string | null;
  passwordSetAt: string | null;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface UserStoreDb {
  userRow: {
    findMany(args: { orderBy: { email: "asc" } }): Promise<UserRow[]>;
    findUnique(args: { where: { email: string } }): Promise<UserRow | null>;
    upsert(args: { where: { email: string }; create: UserRow; update: { name: string; department: string; roles: string; permissions: string; active: boolean } }): Promise<UserRow>;
    update(args: { where: { email: string }; data: { active?: boolean; passwordHash?: string; passwordSetAt?: string } }): Promise<UserRow>;
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
    createdAt: row.createdAt,
    ...(row.passwordSetAt ? { passwordSetAt: row.passwordSetAt } : {}),
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
      const createdAt = existing?.createdAt ?? new Date().toISOString();
      const active = input.active ?? existing?.active ?? true;
      const department = input.department ?? existing?.department ?? "";
      const row = await db.userRow.upsert({
        where: { email: input.email },
        create: { email: input.email, name: input.name, department, roles, permissions, active, createdAt, passwordHash: existing?.passwordHash ?? null, passwordSetAt: existing?.passwordSetAt ?? null },
        update: { name: input.name, department, roles, permissions, active },
      });
      return rowToUser(row);
    },
    async setActive(email, active) {
      await db.userRow.update({ where: { email }, data: { active } });
    },
    async setPassword(email, passwordHash) {
      await db.userRow.update({ where: { email }, data: { passwordHash, passwordSetAt: new Date().toISOString() } });
    },
  };
}
