"use client";
/**
 * 品目マスタの CRUD 画面。
 *
 * **新しいアプリの出発点。** ここをコピーして作るので、
 * 「動く最小」ではなく**そのまま業務で使える形**にしてある。
 *
 * 入れてあるもの(すべて実運用で必要になったもの):
 *
 * | | なぜ |
 * |---|---|
 * | `PageShell` | 画面の幅と余白を揃える |
 * | `AsyncBoundary` | 失敗したとき「読み込み中」で止めない |
 * | `Button` の `loading` | 押した後に反応が無いと二重に押される |
 * | `ConfirmDialog` | 取り消せない操作の確認(何が対象かを名指し) |
 * | 絞り込み | 件数が増えると一覧から探せない |
 * | CSV 出力 | 「Excel で見たい」は必ず言われる |
 * @packageDocumentation
 */
import * as React from "react";
import {
  Alert, AsyncBoundary, Button, Checkbox, ConfirmDialog, Input, PageShell, SimplePagination } from "@platform/ui";
import { toCsv } from "@platform/csv";
import { formatDateJst } from "@platform/datetime";

/** 品目。 */
interface Item { code: string; name: string; note?: string; active: boolean }
/** 項目ごとの検証エラー。 */
interface FieldError { field: string; message: string }

/**
 * 1 ページの件数。
 *
 * **20 にしてあります。** 画面をスクロールせずに全体が見え、
 * かつ「次へ」を押す回数も多すぎない、という目安です。
 * **100 を超えないこと**——描画が重くなり、探すのも大変になります。
 */
const PAGE_SIZE = 20;

/** 品目マスタ。 */
export function ItemsClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [items, setItems] = React.useState<Item[] | null>(null);
  const [showInactive, setShowInactive] = React.useState(false);
  const [keyword, setKeyword] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [form, setForm] = React.useState({ code: "", name: "", note: "" });
  const [errors, setErrors] = React.useState<FieldError[]>([]);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [edit, setEdit] = React.useState({ name: "", note: "" });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  // 無効化しようとしている品目(null なら確認を出さない)
  const [disabling, setDisabling] = React.useState<Item | null>(null);

  /**
   * 一覧を読む。
   *
   * **失敗を握らない。** 握ると「読み込み中…」のまま止まり、
   * 動いているのか壊れているのか分からなくなる。
   */
  const load = React.useCallback(async () => {
    setError("");
    try {
      // **絞り込みと頁送りはサーバで行う。**
      // 画面側で `filter` すると、**全件を取ってから捨てる**ことになり、
      // 件数が増えた日に「一覧を開くと固まる」状態になります
      const q = new URLSearchParams({
        ...(showInactive ? { includeInactive: "1" } : {}),
        ...(keyword.trim() === "" ? {} : { keyword: keyword.trim() }),
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      const r = await doFetch(`/api/items?${q.toString()}`);
      if (!r.ok) {
        // **サーバが用意した利用者向けの文言を使う。**
        // 画面ごとに文言を書くと、**同じ状況なのに違うことを言う**状態になる
        // （「もう一度お試しください」と「管理者に連絡」が混在する）
        const body = (await r.json().catch(() => ({}))) as {
          error?: { userMessage?: { title: string; action: string } };
        };
        const um = body.error?.userMessage;
        setError(um === undefined ? "品目を取得できませんでした" : `${um.title}。${um.action}`);
        return;
      }
      const body = (await r.json()) as {
        items: Item[]; total: number; page: number; pageCount: number;
      };
      setItems(body.items);
      setTotal(body.total);
      setPageCount(body.pageCount);
      // **サーバが寄せたページ番号に合わせる。** 絞り込みで件数が減ると、
      // 3 頁目にいたまま該当なしになる——サーバ側で最後の頁へ寄せている
      if (body.page !== page) setPage(body.page);
    } catch {
      setError("通信に失敗しました。ネットワークを確認してください");
    }
  }, [doFetch, showInactive, keyword, page]);

  React.useEffect(() => { void load(); }, [load]);

  /** 送信をまとめる。**押下の反応と失敗の扱いを 1 か所に置く。** */
  const send = async (url: string, method: string, body: unknown): Promise<boolean> => {
    setBusy(true);
    setErrors([]);
    setError("");
    try {
      const r = await doFetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) { await load(); return true; }
      const d = (await r.json().catch(() => ({}))) as { errors?: FieldError[]; error?: string };
      // **項目ごとのエラーは項目の近くに出す。** 上にまとめると探させる
      if (d.errors !== undefined) setErrors(d.errors);
      else setError(d.error ?? "保存できませんでした");
      return false;
    } catch {
      setError("通信に失敗しました。ネットワークを確認してください");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (await send("/api/items", "POST", form)) setForm({ code: "", name: "", note: "" });
  };

  const saveEdit = async (code: string) => {
    if (await send(`/api/items/${code}`, "PUT", edit)) setEditing(null);
  };

  const toggle = async (it: Item) => {
    await send(`/api/items/${it.code}`, "PATCH", { active: !it.active });
    setDisabling(null);
  };

  /** 項目のエラーを引く(無ければ undefined)。 */
  const errorOf = (field: string) => errors.find((e) => e.field === field)?.message;

  // **絞り込みはサーバで済んでいる**(2026-08 に移した)。
  // ここで再度 `filter` すると、**サーバが返した件数と画面の件数がずれます**
  const shown = items ?? [];

  /**
   * CSV に出す。
   *
   * **「Excel で見たい」は必ず言われる。** 雛形の段階で入れておく。
   * `bom: true` を渡すと Excel でも文字化けしない(既定は false)。
   */
  const exportCsv = () => {
    const csv = toCsv(
      shown.map((it) => ({
        コード: it.code, 名称: it.name, 備考: it.note ?? "", 状態: it.active ? "有効" : "無効",
      })),
      // **BOM を付ける。** 付けないと Excel で開いたとき日本語が化ける
      // (既定は false。CSV の仕様としては不要だが、Excel が要求する)
      { bom: true },
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
        // **ファイル名の日付も JST。**
    // UTC だと朝 9 時前に出したファイルが前日の名前になる
    a.download = `items-${formatDateJst()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell
      title="品目マスタ"
      description="新しいアプリを作るときの出発点です。一覧・登録・編集・無効化(消さずに残す)が入っています。"
      actions={
        <Button variant="secondary" onClick={exportCsv} disabled={shown.length === 0}>
          CSV に出す
        </Button>
      }
    >
      {error !== "" && <Alert variant="danger" className="mb-3">{error}</Alert>}

      {/* 登録 */}
      <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-32 flex-1">
            <span className="mb-1 block text-xs text-[var(--color-muted)]">コード</span>
            <Input
              value={form.code}
              placeholder="ITEM-001"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, code: e.target.value })}
            />
            {errorOf("code") !== undefined && (
              <span className="text-xs text-[var(--color-danger)]">{errorOf("code")}</span>
            )}
          </label>
          <label className="min-w-32 flex-1">
            <span className="mb-1 block text-xs text-[var(--color-muted)]">名称</span>
            <Input
              value={form.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })}
            />
            {errorOf("name") !== undefined && (
              <span className="text-xs text-[var(--color-danger)]">{errorOf("name")}</span>
            )}
          </label>
          <label className="min-w-32 flex-1">
            <span className="mb-1 block text-xs text-[var(--color-muted)]">備考</span>
            <Input
              value={form.note}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, note: e.target.value })}
            />
          </label>
          {/* **押した後に反応を見せる。** 見えないと二重に押され、2 件登録される */}
          <Button loading={busy} loadingLabel="登録中…" onClick={() => void add()}>登録</Button>
        </div>
      </div>

      {/* 絞り込み */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input
          aria-label="コードまたは名称で絞り込む"
          value={keyword}
          placeholder="コード・名称で絞り込む"
          className="max-w-64"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setKeyword(e.target.value);
            // **絞り込みを変えたら 1 頁目へ戻す。** 3 頁目にいたまま
            // 絞り込むと**該当なし**になり、「消えた」と思われます
            setPage(1);
          }}
        />
        <label className="inline-flex items-center gap-2 text-sm">
          <Checkbox checked={showInactive} onCheckedChange={(v) => setShowInactive(v === true)} />
          無効も表示
        </label>
        <span className="text-sm text-[var(--color-muted)]">{shown.length} 件</span>
      </div>

      <AsyncBoundary
        loading={items === null}
        error={error}
        onRetry={() => void load()}
        isEmpty={shown.length === 0}
        emptyTitle={keyword === "" ? "品目がありません" : "一致する品目がありません"}
        emptyDescription={
          keyword === "" ? "上のフォームから登録すると、ここに並びます。" : "別の言葉で探してみてください。"
        }
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
              <th className="p-2">コード</th>
              <th className="p-2">名称</th>
              <th className="p-2">備考</th>
              <th className="p-2">状態</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((it) => (
              <tr
                key={it.code}
                className={`border-b border-[var(--color-border)] ${it.active ? "" : "opacity-50"}`}
              >
                <td className="p-2"><code>{it.code}</code></td>
                {editing === it.code ? (
                  <>
                    <td className="p-2">
                      <Input
                        aria-label="名称"
                        value={edit.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEdit({ ...edit, name: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        aria-label="備考"
                        value={edit.note}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEdit({ ...edit, note: e.target.value })}
                      />
                    </td>
                    <td className="p-2" colSpan={2}>
                      <Button size="sm" loading={busy} loadingLabel="保存中…" onClick={() => void saveEdit(it.code)}>
                        保存
                      </Button>{" "}
                      <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>取消</Button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-2">{it.name}</td>
                    <td className="p-2 text-[var(--color-muted)]">{it.note}</td>
                    {/* **色だけで状態を伝えない。** 文字でも分かるようにする */}
                    <td className="p-2">{it.active ? "有効" : "無効"}</td>
                    <td className="p-2 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => { setEditing(it.code); setEdit({ name: it.name, note: it.note ?? "" }); }}
                      >
                        編集
                      </Button>{" "}
                      <Button
                        size="sm"
                        variant="ghost"
                        // **無効化は確認を取る。** 有効化は戻せるので取らない
                        onClick={() => (it.active ? setDisabling(it) : void toggle(it))}
                      >
                        {it.active ? "無効化" : "有効化"}
                      </Button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* **一覧の下に置く。** 表の上に置くと、
            「読んでから次へ」という自然な視線の流れに合いません。
            **件数も一緒に出す**ので、`totalItems` と `pageSize` を渡します */}
        <SimplePagination
          className="mt-4"
          page={page}
          totalPages={pageCount}
          totalItems={total}
          pageSize={PAGE_SIZE}
          onPageChange={(p) => {
            setPage(p);
            // **一覧の先頭へ戻す。** 下の方を見たまま次頁に行くと、
            // 「押したのに何も変わらない」ように見えます
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </AsyncBoundary>

      {/* **何を無効化するのかを名指しする。**
          「無効化しますか」だけでは、どれが対象か分からない */}
      <ConfirmDialog
        open={disabling !== null}
        onOpenChange={(o) => { if (!o) setDisabling(null); }}
        title={disabling !== null ? `${disabling.name} を無効にします` : ""}
        description="一覧から見えなくなります。データは残るので、後から有効に戻せます。"
        confirmText="無効にする"
        destructive
        onConfirm={() => { if (disabling !== null) void toggle(disabling); }}
      />
    </PageShell>
  );
}
