"use client";
/**
 * データテーブルの完成テンプレート(外部制御版)。
 * SearchInput(検索)+ Select(絞り込み)+ queryRows(検索/ソート/ページング)+ Pagination を配線し、
 * 検索・フィルタ・並べ替え・ページャを完全に手元で制御する一覧の作り方を示す。
 * (検索/ページング内蔵で済むなら <DataTable searchKeys pageSize /> 単体でも可)
 * @packageDocumentation
 */
import * as React from "react";
import {
  SearchInput, Select, Pagination, Button, EmptyState, Badge,
  queryRows, type TableQuery,
} from "@platform/ui";

/** 表示する行(ユーザー)。 */
export interface UserRow extends Record<string, unknown> {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  status: "active" | "invited" | "suspended";
}

const ROLE_LABELS: Record<UserRow["role"], string> = { admin: "管理者", editor: "編集者", viewer: "閲覧者" };
const STATUS_LABELS: Record<UserRow["status"], string> = { active: "有効", invited: "招待中", suspended: "停止" };
const PAGE_SIZE = 10;

/** {@link UserTable} の props。 */
export interface UserTableProps {
  users: UserRow[];
  onExport?: (rows: UserRow[]) => void;
}

/** 検索 + 役割フィルタ + ソート + ページャ付きのユーザー一覧。 */
export function UserTable({ users, onExport }: UserTableProps) {
  const [search, setSearch] = React.useState("");
  const [role, setRole] = React.useState<"all" | UserRow["role"]>("all");
  const [sortKey, setSortKey] = React.useState<keyof UserRow>("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [page, setPage] = React.useState(1);

  // 1) カスタムフィルタ(役割)→ 2) queryRows(検索/ソート/ページング)
  const filtered = React.useMemo(() => (role === "all" ? users : users.filter((u) => u.role === role)), [users, role]);
  const query: TableQuery = { search, searchKeys: ["name", "email"], sortKey: sortKey as string, sortDir, page, pageSize: PAGE_SIZE };
  const result = React.useMemo(() => queryRows(filtered, query), [filtered, search, sortKey, sortDir, page]);

  // 条件変更でページを先頭に戻す
  React.useEffect(() => { setPage(1); }, [search, role, sortKey, sortDir]);

  function toggleSort(key: keyof UserRow) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }
  const sortMark = (key: keyof UserRow) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onValueChange={setSearch} placeholder="名前・メールで検索" className="max-w-xs" />
        <Select
          value={role}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRole(e.target.value as typeof role)}
          options={[
            { value: "all", label: "すべての役割" },
            { value: "admin", label: "管理者" },
            { value: "editor", label: "編集者" },
            { value: "viewer", label: "閲覧者" },
          ]}
        />
        <span className="text-sm text-[var(--color-muted)]">{result.total}件</span>
        {onExport && <Button variant="secondary" className="ml-auto" onClick={() => onExport(result.rows)}>エクスポート</Button>}
      </div>

      {result.total === 0 ? (
        <EmptyState title="該当するユーザーがいません" description="検索条件やフィルタを変えてください。" />
      ) : (
        <>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-muted)]">
                <th className="cursor-pointer py-2 pr-4" onClick={() => toggleSort("name")}>名前{sortMark("name")}</th>
                <th className="cursor-pointer py-2 pr-4" onClick={() => toggleSort("email")}>メール{sortMark("email")}</th>
                <th className="py-2 pr-4">役割</th>
                <th className="py-2">状態</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((u) => (
                <tr key={u.id} className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-4 font-medium text-[var(--color-fg)]">{u.name}</td>
                  <td className="py-2 pr-4 text-[var(--color-muted)]">{u.email}</td>
                  <td className="py-2 pr-4">{ROLE_LABELS[u.role]}</td>
                  <td className="py-2"><Badge variant={u.status === "active" ? "success" : u.status === "suspended" ? "danger" : "default"}>{STATUS_LABELS[u.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination page={result.page} totalPages={result.pageCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
