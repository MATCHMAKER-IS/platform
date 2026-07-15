/** DB Viewer API(管理者専用)。テーブル一覧・スキーマ・データ・SQL実行・行操作。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { listTables, describeTable, selectRows, insertRow, updateRows, deleteRows, runSql, createTable, dropTable, addColumn, dropColumn, exportTableCsv, importTableCsv, type ColumnDef } from "../../../../server/db-viewer.js";

function requireAdmin(req: Request): boolean {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  try { requirePermission(user, "admin"); return true; } catch { return false; }
}

async function handleGET(req: Request): Promise<Response> {
  if (!requireAdmin(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const u = new URL(req.url);
  const table = u.searchParams.get("table");
  if (table && u.searchParams.get("export") === "csv") {
    const r = await exportTableCsv(table);
    if (!r.ok) return Response.json({ error: r.error.message }, { status: 404 });
    return new Response(r.value, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${table}.csv"` } });
  }
  if (!table) {
    const r = await listTables();
    return r.ok ? Response.json({ tables: r.value }) : Response.json({ error: r.error.message }, { status: 500 });
  }
  const schema = await describeTable(table);
  if (!schema.ok) return Response.json({ error: schema.error.message }, { status: 404 });
  const rows = await selectRows(table, { limit: Number(u.searchParams.get("limit") ?? 50), offset: Number(u.searchParams.get("offset") ?? 0) });
  if (!rows.ok) return Response.json({ error: rows.error.message }, { status: 500 });
  return Response.json({ columns: schema.value, rows: rows.value.rows, total: rows.value.total });
}

async function handlePOST(req: Request): Promise<Response> {
  if (!requireAdmin(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const body = (await req.json()) as { action?: string; table?: string; values?: Record<string, unknown>; where?: Record<string, unknown>; sql?: string; allowDanger?: boolean; allowDdl?: boolean; columns?: ColumnDef[]; column?: ColumnDef | string; csv?: string };
  if (body.action === "sql" && body.sql !== undefined) {
    const r = await runSql(body.sql, { allowDanger: body.allowDanger === true, allowDdl: body.allowDdl === true });
    return r.ok ? Response.json(r.value) : Response.json({ error: r.error.message, code: r.error.code }, { status: 200 });
  }
  if (body.action === "insert" && body.table && body.values) {
    const r = await insertRow(body.table, body.values);
    return r.ok ? Response.json({ affected: r.value }) : Response.json({ error: r.error.message }, { status: 200 });
  }
  if (body.action === "update" && body.table && body.values && body.where) {
    const r = await updateRows(body.table, body.values, body.where);
    return r.ok ? Response.json({ affected: r.value }) : Response.json({ error: r.error.message }, { status: 200 });
  }
  if (body.action === "delete" && body.table && body.where) {
    const r = await deleteRows(body.table, body.where);
    return r.ok ? Response.json({ affected: r.value }) : Response.json({ error: r.error.message }, { status: 200 });
  }
  if (body.action === "createTable" && body.table && body.columns) {
    const r = await createTable(body.table, body.columns);
    return r.ok ? Response.json({ affected: r.value }) : Response.json({ error: r.error.message }, { status: 200 });
  }
  if (body.action === "dropTable" && body.table) {
    const r = await dropTable(body.table);
    return r.ok ? Response.json({ affected: r.value }) : Response.json({ error: r.error.message }, { status: 200 });
  }
  if (body.action === "addColumn" && body.table && body.column && typeof body.column === "object") {
    const r = await addColumn(body.table, body.column);
    return r.ok ? Response.json({ affected: r.value }) : Response.json({ error: r.error.message }, { status: 200 });
  }
  if (body.action === "dropColumn" && body.table && typeof body.column === "string") {
    const r = await dropColumn(body.table, body.column);
    return r.ok ? Response.json({ affected: r.value }) : Response.json({ error: r.error.message }, { status: 200 });
  }
  if (body.action === "importCsv" && body.table && body.csv !== undefined) {
    const r = await importTableCsv(body.table, body.csv);
    return r.ok ? Response.json(r.value) : Response.json({ error: r.error.message }, { status: 200 });
  }
  return Response.json({ error: "不正なリクエストです" }, { status: 400 });
}

export const GET = withApiObservability("/api/admin/db-viewer", handleGET);
export const POST = withApiObservability("/api/admin/db-viewer", handlePOST);
