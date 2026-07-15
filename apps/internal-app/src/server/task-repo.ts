/**
 * タスクのデータアクセス。**Prisma 実装とメモリ実装を持つ**。
 *
 * - `PERSISTENCE=prisma`(既定): DB に保存(再起動しても残る)
 * - それ以外: メモリ(DB 不要ですぐ試せる。再起動で消える)
 *
 * ロジックは `@platform/task` の担当。ここは保存と取り出しだけ。
 * @packageDocumentation
 */
import { randomUUID } from "node:crypto";
import type { Task, TaskStatus, TaskPriority } from "@platform/task";
import { db } from "./services.js";
import { featureEnv } from "./env.js";

/** 保存先。 */
export interface TaskStore {
  list(): Promise<Task[]>;
  get(id: string): Promise<Task | undefined>;
  create(input: CreateTaskInput): Promise<Task>;
  update(id: string, patch: Partial<Task>): Promise<Task | undefined>;
  remove(id: string): Promise<boolean>;
}

/** 新規作成の入力。 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  assignee?: string;
  dueDate?: string;
  projectId?: string;
  parentId?: string;
  estimateHours?: number;
}

/** メモリ実装(開発・評価用。再起動で消える)。 */
export function createMemoryTaskStore(seed: Task[] = []): TaskStore {
  const items = new Map<string, Task>(seed.map((t) => [t.id, t]));
  return {
    async list() {
      return [...items.values()];
    },
    async get(id) {
      return items.get(id);
    },
    async create(input) {
      const now = new Date().toISOString();
      const task: Task = {
        id: randomUUID(),
        title: input.title,
        status: "todo",
        priority: input.priority ?? "normal",
        createdAt: now,
        updatedAt: now,
        ...(input.description ? { description: input.description } : {}),
        ...(input.assignee ? { assignee: input.assignee } : {}),
        ...(input.dueDate ? { dueDate: input.dueDate } : {}),
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.parentId ? { parentId: input.parentId } : {}),
        ...(input.estimateHours !== undefined ? { estimateHours: input.estimateHours } : {}),
      };
      items.set(task.id, task);
      return task;
    },
    async update(id, patch) {
      const cur = items.get(id);
      if (!cur) return undefined;
      const next: Task = { ...cur, ...patch, id: cur.id, updatedAt: new Date().toISOString() };
      items.set(id, next);
      return next;
    },
    async remove(id) {
      return items.delete(id);
    },
  };
}

/** Prisma の Task 行(生成型の必要部分)。 */
export interface PrismaTaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee: string | null;
  dueDate: Date | null;
  projectId: string | null;
  parentId: string | null;
  estimateHours: number | null;
  actualHours: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Prisma 行 → アプリの Task。
 *
 * DB は null、アプリは undefined で「無い」を表す(TypeScript の慣習に合わせる)。
 * dueDate は日付のみ扱うため YYYY-MM-DD に落とす。
 *
 * @param row Prisma が返す行
 * @returns アプリで扱う {@link Task}
 */
export function prismaTaskToTask(row: PrismaTaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.description ? { description: row.description } : {}),
    ...(row.assignee ? { assignee: row.assignee } : {}),
    ...(row.dueDate ? { dueDate: row.dueDate.toISOString().slice(0, 10) } : {}),
    ...(row.projectId ? { projectId: row.projectId } : {}),
    ...(row.parentId ? { parentId: row.parentId } : {}),
    ...(row.estimateHours !== null ? { estimateHours: row.estimateHours } : {}),
    ...(row.actualHours !== null ? { actualHours: row.actualHours } : {}),
  };
}

/** Prisma 実装(本番用)。 */
export function createPrismaTaskStore(): TaskStore {
  const model = (db as unknown as { task: {
    findMany(a?: unknown): Promise<PrismaTaskRow[]>;
    findUnique(a: unknown): Promise<PrismaTaskRow | null>;
    create(a: unknown): Promise<PrismaTaskRow>;
    update(a: unknown): Promise<PrismaTaskRow>;
    delete(a: unknown): Promise<unknown>;
  } }).task;

  return {
    async list() {
      return (await model.findMany({ orderBy: { createdAt: "desc" } })).map(prismaTaskToTask);
    },
    async get(id) {
      const row = await model.findUnique({ where: { id } });
      return row ? prismaTaskToTask(row) : undefined;
    },
    async create(input) {
      const row = await model.create({
        data: {
          title: input.title,
          priority: input.priority ?? "normal",
          description: input.description ?? null,
          assignee: input.assignee ?? null,
          dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00Z`) : null,
          projectId: input.projectId ?? null,
          parentId: input.parentId ?? null,
          estimateHours: input.estimateHours ?? null,
        },
      });
      return prismaTaskToTask(row);
    },
    async update(id, patch) {
      try {
        const row = await model.update({
          where: { id },
          data: {
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
            ...(patch.assignee !== undefined ? { assignee: patch.assignee ?? null } : {}),
            ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate ? new Date(`${patch.dueDate}T00:00:00Z`) : null } : {}),
            ...(patch.estimateHours !== undefined ? { estimateHours: patch.estimateHours ?? null } : {}),
            ...(patch.actualHours !== undefined ? { actualHours: patch.actualHours ?? null } : {}),
          },
        });
        return prismaTaskToTask(row);
      } catch {
        return undefined; // 無い id は undefined(呼び出し側で 404 にする)
      }
    },
    async remove(id) {
      try {
        await model.delete({ where: { id } });
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** 動かして確かめられるよう、最初から少しデータを入れておく。 */
function seedTasks(): Task[] {
  const day = (offset: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const base = { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const mk = (id: string, title: string, status: TaskStatus, priority: TaskPriority, o: Partial<Task> = {}): Task =>
    ({ id, title, status, priority, ...base, ...o });

  return [
    mk("t1", "経費申請の添付機能", "doing", "high", { assignee: "田中", dueDate: day(3), projectId: "p1", estimateHours: 8, actualHours: 5 }),
    mk("t2", "勤怠の月次集計を高速化", "todo", "urgent", { assignee: "鈴木", dueDate: day(-2), projectId: "p1", estimateHours: 16 }),
    mk("t3", "請求書 PDF のレイアウト修正", "review", "normal", { assignee: "田中", dueDate: day(7), projectId: "p1", estimateHours: 4, actualHours: 4 }),
    mk("t4", "在庫アラートの通知先を追加", "done", "normal", { assignee: "佐藤", projectId: "p2", estimateHours: 2, actualHours: 3 }),
    mk("t5", "旧レポート機能の廃止", "canceled", "low", { projectId: "p2" }),
    mk("t6", "新人向けオンボーディング資料", "todo", "low", { dueDate: day(14), estimateHours: 6 }),
  ];
}

/**
 * アプリで共有するストア。
 *
 * `PERSISTENCE=prisma` なら DB、それ以外はメモリ(seed 付き)。
 * **DB を用意しなくても触れる**ようにしてある(評価・デモ用)。
 */
export const taskStore: TaskStore = featureEnv.TASK_PERSISTENCE === "prisma"
  ? createPrismaTaskStore()
  : createMemoryTaskStore(seedTasks());
