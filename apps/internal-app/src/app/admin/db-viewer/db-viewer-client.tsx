"use client";
/** DB Viewer(phpMyAdmin 的)。テーブル閲覧・SQL 実行。管理者専用。危険操作は確認を挟む。 */
import * as React from "react";
import { Button, Checkbox, Input, Textarea } from "@platform/ui";

interface Column { column: string; type: string; nullable: boolean; default: string | null; }
interface TableInfo { name: string; rows: number; }

export function DbViewerClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [tables, setTables] = React.useState<TableInfo[]>([]);
  const [active, setActive] = React.useState<string>("");
  const [columns, setColumns] = React.useState<Column[]>([]);
  const [rows, setRows] = React.useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = React.useState(0);
  const [tab, setTab] = React.useState<"browse" | "sql" | "schema">("browse");
  const [newTable, setNewTable] = React.useState("");
  const [newCols, setNewCols] = React.useState<{ name: string; type: string }[]>([{ name: "id", type: "serial" }]);
  const [colName, setColName] = React.useState("");
  const [colType, setColType] = React.useState("text");
  const [schemaMsg, setSchemaMsg] = React.useState("");
  const [sql, setSql] = React.useState("SELECT 1");
  const [sqlResult, setSqlResult] = React.useState<{ kind?: string; rows?: Record<string, unknown>[]; affected?: number; error?: string } | null>(null);
  const [allowDanger, setAllowDanger] = React.useState(false);

  const loadTables = async () => {
    const r = await doFetch("/api/admin/db-viewer");
    const d = await r.json();
    if (r.ok) setTables(d.tables as TableInfo[]);
  };
  React.useEffect(() => { void loadTables(); }, []);

  const openTable = async (name: string) => {
    setActive(name); setTab("browse");
    const r = await doFetch(`/api/admin/db-viewer?table=${encodeURIComponent(name)}&limit=50`);
    const d = await r.json();
    if (r.ok) { setColumns(d.columns as Column[]); setRows(d.rows as Record<string, unknown>[]); setTotal(d.total as number); }
  };

  const runSql = async () => {
    setSqlResult(null);
    const r = await doFetch("/api/admin/db-viewer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "sql", sql, allowDanger }) });
    const d = await r.json();
    setSqlResult(d);
  };

  const ddl = async (payload: Record<string, unknown>, successMsg: string) => {
    setSchemaMsg("");
    const r = await doFetch("/api/admin/db-viewer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const d = await r.json();
    setSchemaMsg(r.ok && !d.error ? successMsg : (d.error ?? "失敗しました"));
    await loadTables();
  };
  const createTable = () => ddl({ action: "createTable", table: newTable, columns: newCols.filter((c) => c.name.trim() && c.type.trim()) }, `テーブル ${newTable} を作成しました`);
  const dropTable = (name: string) => { if ((globalThis as unknown as { confirm(m: string): boolean }).confirm(`テーブル ${name} を削除しますか？この操作は取り消せません。`)) void ddl({ action: "dropTable", table: name }, `テーブル ${name} を削除しました`); };
  const addCol = () => ddl({ action: "addColumn", table: active, column: { name: colName, type: colType } }, `カラム ${colName} を追加しました`);
  const dropCol = (name: string) => { if ((globalThis as unknown as { confirm(m: string): boolean }).confirm(`カラム ${name} を削除しますか？`)) void ddl({ action: "dropColumn", table: active, column: name }, `カラム ${name} を削除しました`); };

  const sidebar: React.CSSProperties = { width: 220, borderRight: "1px solid #eee", padding: 12, overflowY: "auto" };
  const cell: React.CSSProperties = { border: "1px solid #eee", padding: "4px 8px", fontSize: 12, textAlign: "left", whiteSpace: "nowrap", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", height: "100vh", display: "flex" }}>
      <div style={sidebar}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>テーブル（{tables.length}）</div>
        {tables.map((t) => (
          <Button key={t.name} type="button" onClick={() => openTable(t.name)} aria-current={active === t.name ? "true" : undefined} style={{ width: "100%", border: "none", textAlign: "left", font: "inherit", padding: "5px 8px", borderRadius: 6, cursor: "pointer", fontSize: 13, background: active === t.name ? "#eef2ff" : "transparent", display: "flex", justifyContent: "space-between" }}>
            <span>{t.name}</span><span style={{ color: "var(--color-muted, #aaa)", fontSize: 11 }}>{t.rows}</span>
          </Button>
        ))}
      </div>

      <div style={{ flex: 1, padding: 16, overflow: "auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Button onClick={() => setTab("browse")} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #ddd", background: tab === "browse" ? "var(--color-primary, #2563eb)" : "var(--color-surface, #fff)", color: tab === "browse" ? "var(--color-surface, #fff)" : "#333" }}>閲覧</Button>
          <Button onClick={() => setTab("sql")} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #ddd", background: tab === "sql" ? "var(--color-primary, #2563eb)" : "var(--color-surface, #fff)", color: tab === "sql" ? "var(--color-surface, #fff)" : "#333" }}>SQL 実行</Button>
          <Button onClick={() => setTab("schema")} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #ddd", background: tab === "schema" ? "var(--color-primary, #2563eb)" : "var(--color-surface, #fff)", color: tab === "schema" ? "var(--color-surface, #fff)" : "#333" }}>スキーマ操作</Button>
        </div>

        {tab === "browse" && (
          active === "" ? <p style={{ color: "var(--color-muted, #999)", fontSize: 13 }}>左のテーブルを選択してください。</p> : (
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{active} <span style={{ fontSize: 12, color: "var(--color-muted, #999)", fontWeight: 400 }}>（{total} 行）</span></div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse" }}>
                  <thead><tr>{columns.map((c) => <th key={c.column} style={{ ...cell, background: "#f8f8f8", fontWeight: 600 }}>{c.column}<div style={{ fontSize: 10, color: "var(--color-muted, #aaa)", fontWeight: 400 }}>{c.type}</div></th>)}</tr></thead>
                  <tbody>{rows.map((row, i) => <tr key={i}>{columns.map((c) => <td key={c.column} style={cell}>{row[c.column] === null ? <span style={{ color: "#ccc" }}>NULL</span> : String(row[c.column])}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          )
        )}

        {tab === "sql" && (
          <div>
            <Textarea value={sql} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSql(e.target.value)} rows={5} style={{ width: "100%", boxSizing: "border-box", fontFamily: "monospace", fontSize: 13, padding: 10, border: "1px solid #ddd", borderRadius: 8 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
              <Button onClick={runSql} style={{ padding: "8px 20px", background: "var(--color-primary, #2563eb)", color: "var(--color-surface, #fff)", border: "none", borderRadius: 8 }}>実行</Button>
              <label style={{ fontSize: 12, color: "var(--color-warning, #b45309)" }}><Checkbox  checked={allowDanger} onCheckedChange={(v) => setAllowDanger(!!v)} /> DROP/TRUNCATE 等の危険操作を許可</label>
            </div>
            {sqlResult && (
              <div style={{ marginTop: 12 }}>
                {sqlResult.error ? <p style={{ color: "var(--color-danger, #c00)", fontSize: 13 }}>{sqlResult.error}</p> : sqlResult.rows ? (
                  <div style={{ overflowX: "auto" }}>
                    <div style={{ fontSize: 12, color: "var(--color-success, #16a34a)", marginBottom: 4 }}>{sqlResult.rows.length} 行</div>
                    <table style={{ borderCollapse: "collapse" }}>
                      <thead><tr>{Object.keys(sqlResult.rows[0] ?? {}).map((k) => <th key={k} style={{ ...cell, background: "#f8f8f8" }}>{k}</th>)}</tr></thead>
                      <tbody>{sqlResult.rows.map((row, i) => <tr key={i}>{Object.keys(sqlResult.rows?.[0] ?? {}).map((k) => <td key={k} style={cell}>{row[k] === null ? "NULL" : String(row[k])}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                ) : <p style={{ fontSize: 13, color: "var(--color-success, #16a34a)" }}>{sqlResult.affected} 行に影響しました（{sqlResult.kind}）</p>}
              </div>
            )}
          </div>
        )}

        {tab === "schema" && (
          <div style={{ maxWidth: 640 }}>
            <div style={{ background: "var(--color-surface, #fff)", border: "1px solid #e8e8e8", borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>テーブル作成</div>
              <Input value={newTable} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTable(e.target.value)} placeholder="テーブル名" style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, marginBottom: 8, width: 240 }} />
              {newCols.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <Input value={c.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCols(newCols.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="カラム名" style={{ padding: "5px 8px", border: "1px solid #ddd", borderRadius: 6, flex: 1 }} />
                  <Input value={c.type} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCols(newCols.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} placeholder="型（text, integer...）" style={{ padding: "5px 8px", border: "1px solid #ddd", borderRadius: 6, flex: 1 }} />
                  <Button aria-label="この列を削除" title="この列を削除" onClick={() => setNewCols(newCols.filter((_, j) => j !== i))} style={{ color: "var(--color-danger, #c00)", background: "none", border: "none", cursor: "pointer" }}>×</Button>
                </div>
              ))}
              <Button onClick={() => setNewCols([...newCols, { name: "", type: "text" }])} style={{ fontSize: 12, background: "none", border: "1px dashed #ccc", borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>+ カラム追加</Button>
              <div style={{ marginTop: 12 }}><Button onClick={createTable} disabled={newTable.trim().length === 0} style={{ padding: "8px 20px", background: "var(--color-success, #16a34a)", color: "var(--color-surface, #fff)", border: "none", borderRadius: 8 }}>テーブルを作成</Button></div>
            </div>

            {active !== "" && (
              <div style={{ background: "var(--color-surface, #fff)", border: "1px solid #e8e8e8", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{active} のカラム操作</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <Input value={colName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColName(e.target.value)} placeholder="新カラム名" style={{ padding: "5px 8px", border: "1px solid #ddd", borderRadius: 6, flex: 1 }} />
                  <Input value={colType} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColType(e.target.value)} placeholder="型" style={{ padding: "5px 8px", border: "1px solid #ddd", borderRadius: 6, flex: 1 }} />
                  <Button onClick={addCol} disabled={colName.trim().length === 0} style={{ padding: "5px 14px", background: "var(--color-primary, #2563eb)", color: "var(--color-surface, #fff)", border: "none", borderRadius: 6 }}>カラム追加</Button>
                </div>
                {columns.map((c) => (
                  <div key={c.column} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 13 }}>
                    <code>{c.column}</code><span style={{ color: "var(--color-muted, #aaa)", fontSize: 11 }}>{c.type}</span>
                    <Button onClick={() => dropCol(c.column)} style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-danger, #c00)", background: "none", border: "none", cursor: "pointer" }}>削除</Button>
                  </div>
                ))}
                <div style={{ marginTop: 12, borderTop: "1px solid #f0f0f0", paddingTop: 12 }}>
                  <Button onClick={() => dropTable(active)} style={{ padding: "6px 16px", background: "var(--color-surface, #fff)", color: "var(--color-danger, #c00)", border: "1px solid #fca5a5", borderRadius: 8 }}>このテーブルを削除</Button>
                </div>
              </div>
            )}
            {schemaMsg && <p style={{ fontSize: 13, color: schemaMsg.includes("しました") ? "var(--color-success, #16a34a)" : "var(--color-danger, #c00)" }}>{schemaMsg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
