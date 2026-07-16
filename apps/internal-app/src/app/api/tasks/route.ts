/**
 * タスク API。ロジックは `@platform/task`、保存は task-repo の担当。
 * ここは HTTP の入出力と認可だけを見る。
 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { taskStore } from "../../../server/task-repo";
import { summarize, toKanban, sortTasks, filterTasks, transition, workloadByAssignee, type TaskStatus } from "@platform/task";
import { AppError } from "@platform/core";

function user(req: Request) {
  return currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
}

async function handleGET(req: Request): Promise<Response> {
  if (!user(req)) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const url = new URL(req.url);
  const all = await taskStore.list();

  const projectId = url.searchParams.get("projectId") ?? undefined;
  const assignee = url.searchParams.get("assignee") ?? undefined;
  const overdueOnly = url.searchParams.get("overdue") === "1";
  const filtered = filterTasks(all, {
    ...(projectId ? { projectId } : {}),
    ...(assignee ? { assignee } : {}),
    ...(overdueOnly ? { overdueOnly } : {}),
  });

  return Response.json({
    tasks: sortTasks(filtered),
    kanban: toKanban(filtered),
    summary: summarize(filtered),
    workload: workloadByAssignee(filtered),
  });
}

async function handlePOST(req: Request): Promise<Response> {
  const u = user(req);
  if (!u) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const body = (await req.json()) as { title?: string; priority?: string; assignee?: string; dueDate?: string; projectId?: string; estimateHours?: number };
  if (!body.title?.trim()) return Response.json({ error: "件名を入力してください" }, { status: 400 });

  const task = await taskStore.create({
    title: body.title.trim(),
    ...(body.priority ? { priority: body.priority as never } : {}),
    ...(body.assignee ? { assignee: body.assignee } : {}),
    ...(body.dueDate ? { dueDate: body.dueDate } : {}),
    ...(body.projectId ? { projectId: body.projectId } : {}),
    ...(body.estimateHours !== undefined ? { estimateHours: body.estimateHours } : {}),
  });
  return Response.json({ task }, { status: 201 });
}

async function handlePATCH(req: Request): Promise<Response> {
  if (!user(req)) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const body = (await req.json()) as { id?: string; status?: TaskStatus; assignee?: string; actualHours?: number };
  if (!body.id) return Response.json({ error: "id が必要です" }, { status: 400 });
  const cur = await taskStore.get(body.id);
  if (!cur) return Response.json({ error: "タスクが見つかりません" }, { status: 404 });

  try {
    // 状態変更は @platform/task の遷移ルールを通す(順序を飛ばせない)
    const next = body.status ? transition(cur, body.status) : cur;
    const updated = await taskStore.update(body.id, {
      ...next,
      ...(body.assignee !== undefined ? { assignee: body.assignee } : {}),
      ...(body.actualHours !== undefined ? { actualHours: body.actualHours } : {}),
    });
    return Response.json({ task: updated });
  } catch (e) {
    if (e instanceof AppError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

export const GET = withApiObservability("/api/tasks", handleGET);
export const POST = withApiObservability("/api/tasks", handlePOST);
export const PATCH = withApiObservability("/api/tasks", handlePATCH);
