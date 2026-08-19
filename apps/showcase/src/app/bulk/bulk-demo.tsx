"use client";

/**
 * **一括操作と取り消しの見本。**
 *
 * 【なぜこの組み合わせか】
 * **100 人規模では、承認者の負担が最初に限界**を迎えます——
 * 月末に 100 件の申請を**1 件ずつ押す**のは現実的でありません。
 *
 * **ただし一括は事故が大きい**です。
 * 「全選択 → 却下」を押し間違えると、**100 件が一度に却下**されます。
 *
 * **だから取り消しと必ず組にしてください。**
 * 「本当に実行しますか？」の確認だけでは足りません——
 * **人は確認を読まずに押します**。**押した後に戻せる**方が確実です。
 */
import { runBulk, createUndoStack, bulkConfirmMessage, Button, Checkbox } from "@platform/ui";
import { useMemo, useState } from "react";

/** 見本のデータ。 */
interface Row {
  id: string;
  title: string;
  amount: number;
  status: "pending" | "rejected";
}

const INITIAL: Row[] = [
  { id: "e1", title: "客先訪問の交通費", amount: 1_200, status: "pending" },
  { id: "e2", title: "会議の茶菓子", amount: 3_500, status: "pending" },
  { id: "e3", title: "書籍（技術書）", amount: 4_800, status: "pending" },
  { id: "e4", title: "出張の宿泊費", amount: 12_000, status: "pending" },
];

/**
 * 一括操作と取り消しの見本。
 *
 * @returns 画面
 */
export function BulkDemo(): React.JSX.Element {
  const [rows, setRows] = useState<Row[]>(INITIAL);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [undoLabel, setUndoLabel] = useState<string | undefined>(undefined);
  const [undoToken, setUndoToken] = useState<string | undefined>(undefined);

  // **取り消しの器は 1 つだけ持ちます。** 押すたびに作ると、
  // **前の取り消しが消えます**。
  const undoStack = useMemo(() => createUndoStack({ ttlMs: 5 * 60_000 }), []);

  const pending = rows.filter((r) => r.status === "pending");
  const selectedCount = selected.size;

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (): void => {
    // **全選択は「見えているもの」だけ**にしてください。
    // 絞り込んだ結果の外まで選ぶと、**見えていないものまで操作**します。
    setSelected(selectedCount === pending.length ? new Set() : new Set(pending.map((r) => r.id)));
  };

  const rejectSelected = async (): Promise<void> => {
    const keys = [...selected];
    if (keys.length === 0) return;

    // **件数を必ず見せてください。**
    // **100 件を 1 件と間違えたときに気づけます**。
    const confirmed = window.confirm(
      bulkConfirmMessage({
        subject: "経費申請", count: keys.length, action: "却下", undoable: true,
      }),
    );
    if (!confirmed) return;

    const before = rows;
    const result = await runBulk(keys, async (key) => {
      // 見本なので、**4 件目だけわざと失敗**させています——
      // **一部が失敗したときの見え方**を確かめるためです。
      if (key === "e4") throw new Error("上長の承認が要る金額です");
      setRows((prev) => prev.map((r) => (r.id === key ? { ...r, status: "rejected" } : r)));
    });

    // **成功した分だけ戻せるようにします。**
    // 失敗したものを戻そうとすると、**また失敗**します。
    const succeededKeys = result.items.filter((i) => i.ok).map((i) => i.key);
    if (succeededKeys.length > 0) {
      const token = undoStack.register({
        label: `経費 ${succeededKeys.length} 件を却下`,
        keys: succeededKeys,
        revert: async () => { setRows(before); },
      });
      setUndoToken(token);
      setUndoLabel(`経費 ${succeededKeys.length} 件を却下しました`);
    }

    setSelected(new Set());
    setMessage(
      result.failed === 0
        ? `${result.succeeded} 件を却下しました。`
        // **失敗したものは理由と一緒に見せます。**
        // 「一部失敗しました」だけだと、**何を直せばよいか分かりません**。
        : `${result.succeeded} 件を却下し、${result.failed} 件が失敗しました：`
          + result.items.filter((i) => !i.ok).map((i) => `${i.key}（${i.error}）`).join("、"),
    );
  };

  const undo = async (): Promise<void> => {
    if (undoToken === undefined) return;
    const r = await undoStack.undo(undoToken);
    setMessage(r.ok ? "取り消しました。" : `取り消せませんでした：${r.reason ?? ""}`);
    setUndoToken(undefined);
    setUndoLabel(undefined);
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <Button type="button" onClick={toggleAll}>
          {selectedCount === pending.length && pending.length > 0 ? "全解除" : "全選択"}
        </Button>
        <Button
          type="button"
          onClick={() => { void rejectSelected(); }}
          // **選んでいないときは押せない**ようにします。
          // 押せると「0 件を却下しました」が出て、**壊れて見えます**。
          disabled={selectedCount === 0}
        >
          選んだ {selectedCount} 件を却下
        </Button>
      </div>

      <table>
        <thead>
          <tr>
            <th scope="col">選択</th>
            <th scope="col">件名</th>
            <th scope="col">金額</th>
            <th scope="col">状態</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Checkbox
                  checked={selected.has(r.id)}
                  onChange={() => { toggle(r.id); }}
                  disabled={r.status !== "pending"}
                  aria-label={`${r.title} を選ぶ`}
                />
              </td>
              <td>{r.title}</td>
              <td style={{ textAlign: "right" }}>{`¥${r.amount.toLocaleString("ja-JP")}`}</td>
              <td>{r.status === "pending" ? "承認待ち" : "却下"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {message !== "" && (
        <p role="status" style={{ color: "var(--color-muted)" }}>{message}</p>
      )}

      {/* **取り消しは目立つところに、時間つきで出します。**
          「5 分以内」と書かないと、**いつまで戻せるか分かりません**。 */}
      {undoToken !== undefined && (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span>{undoLabel}</span>
          <Button type="button" onClick={() => { void undo(); }}>
            取り消す（5 分以内）
          </Button>
        </div>
      )}
    </div>
  );
}
