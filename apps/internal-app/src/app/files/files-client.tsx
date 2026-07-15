"use client";
/**
 * ファイル管理画面。/api/files を取得して FileList を表示、削除もできる。
 * @packageDocumentation
 */
import * as React from "react";
import { FileList, EmptyState, type FileListItem } from "@platform/ui";

interface FileRow {
  key: string;
  name: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface FilesClientProps {
  fetchImpl?: typeof fetch;
}

export function FilesClient({ fetchImpl }: FilesClientProps) {
  const [files, setFiles] = React.useState<FileRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const load = React.useCallback(async () => {
    const res = await doFetch("/api/files");
    setLoading(false);
    if (!res.ok) return;
    const data = (await res.json()) as { files: FileRow[] };
    setFiles(data.files);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onDelete = (key: string) => {
    void doFetch("/api/files", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ key }) }).then(load);
  };

  if (!loading && files.length === 0) return <EmptyState title="ファイルはまだありません" />;
  const items: FileListItem[] = files.map((f) => ({ key: f.key, name: f.name, size: f.size, type: f.type, uploadedAt: f.uploadedAt, uploadedByName: f.uploadedBy }));
  return <FileList files={items} onDelete={onDelete} />;
}
