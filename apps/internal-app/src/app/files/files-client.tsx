"use client";
/**
 * ファイル管理画面。/api/files を取得して FileList を表示、削除もできる。
 * @packageDocumentation
 */
import * as React from "react";
import { Alert, EmptyState, FileInput, FileList, PageShell, type FileListItem, useConfirm } from "@platform/ui";

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
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
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

  const { confirm, dialog } = useConfirm();

  const onDelete = (key: string) => {
    // **消す前に一度確かめる。** 2026-08 まで押した瞬間に消えており、
    // **一覧で隣の行を押し間違えると証憑が失われた**——経費の申請に
    // 添付した領収書なら、**再提出できないと精算が通らない**
    confirm({
      title: "このファイルを削除しますか",
      description: `${key.split("/").pop() ?? key} を削除します。元に戻せません。`,
      onConfirm: () => {
        void doFetch("/api/files", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ key }) }).then(load);
      },
    });
  };

  /**
   * 選ばれたファイルを送る。
   *
   * **`FormData` で送る。** base64 に直すと本文が約 1.33 倍になり、
   * 20MB の上限に対して実質 15MB しか送れなくなる。
   */
  const upload = async (list: File[]) => {
    if (list.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      for (const f of list) form.append("files", f);
      const res = await doFetch("/api/files/upload", { method: "POST", body: form });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "アップロードできませんでした");
        return;
      }
      await load();
    } catch {
      setError("通信に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const items: FileListItem[] = files.map((f) => ({ key: f.key, name: f.name, size: f.size, type: f.type, uploadedAt: f.uploadedAt, uploadedByName: f.uploadedBy }));

  return (
    <PageShell title="ファイル" description="社内で共有する資料を置きます。">

      {error !== "" && <Alert variant="danger" className="mb-3">{error}</Alert>}

      {/* **空でもフォームは出す。** 「まだありません」だけだと、
          どうやって置けばよいのか分からない */}
      <div className="mb-4 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-4">
        {/* **基盤の FileInput を使う。**
            生の `<input type="file">` はブラウザごとに見た目が違い、
            同じファイルを選び直せない(値のリセットが要る)。
            基盤側がどちらも面倒を見てくれる */}
        <p className="mb-2 text-sm font-medium">ファイルを追加</p>
        {/* **アップロード中は選べなくする。** 2026-08 まで `disabled` を渡しておらず、
              連続で選ぶと**同じファイルが二重に上がった**——`busy` の表示は出るが、
              入力そのものは生きていた */}
          <FileInput multiple disabled={busy} label="ファイルを選ぶ" onSelect={(list) => { void upload(list); }} />
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          1 ファイル 20MB まで。{busy ? "アップロード中…" : "複数選べます。"}
        </p>
      </div>

      {!loading && files.length === 0
        ? <EmptyState
            title="ファイルはまだありません"
            description="上の欄からファイルを選ぶと、ここに並びます。1 ファイル 20MB まで。"
          />
        : (
          <FileList
            files={items}
            onDelete={onDelete}
            // **同じタブで開かない。** 別タブにすると、
            // ダウンロードが始まった後に空のタブが残る
            onOpen={(key) => {
              window.location.href = `/api/files/download/${key.split("/").map(encodeURIComponent).join("/")}`;
            }}
          />
        )}
      {/* **確認ダイアログの置き場。** 忘れると確認が出ないまま消える */}
      {dialog}
    </PageShell>
  );
}
