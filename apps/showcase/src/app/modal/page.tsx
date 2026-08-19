"use client";
/**
 * モーダル(ポップアップ)のデモ。
 *
 * 見せたいのは **「開閉の状態を画面が持たなくてよい」** こと。
 * `<ModalHost />` をルートに 1 つ置けば、あとはどこからでも `openModal()` を呼べる
 * (このデモサイトでは layout.tsx に置いてある)。
 *
 * 中身は関数で組む。`params` で値を渡し、`close(値)` で結果を返す —— つまり
 * **開く側と中身が値をやり取りできる**。一覧の行から詳細を開いて、保存されたら
 * 一覧を更新する、という実務でよくある流れがこれだけで書ける。
 *
 * UI は @platform/ui の部品で組む(生タグを書くと check-app-rules が落ちる)。
 */
import * as React from "react";
import { Badge, Button, Input, Separator, openModal, defineModal } from "@platform/ui";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const label: React.CSSProperties = { fontSize: 13, color: "var(--color-muted)", margin: "0 0 10px", lineHeight: 1.8 };

/** 一覧のデータ(このデモは DB を持たないのでメモリだけ)。 */
interface Item {
  code: string;
  name: string;
  note: string;
}

const INITIAL: Item[] = [
  { code: "A-001", name: "折りたたみコンテナ 50L", note: "倉庫 A-3" },
  { code: "A-002", name: "台車 (静音キャスター)", note: "倉庫 B-1" },
  { code: "B-014", name: "ラベルプリンタ用紙", note: "事務所 棚2" },
];

/**
 * 品目の編集モーダル。**定義は 1 箇所、呼ぶのはどこからでも。**
 *
 * `defineModal` を使うと、呼ぶ側は値を渡すだけになる。呼ぶ場所ごとに中身を
 * 書くと、同じ小窓が少しずつ違う形で増えていく。
 */
const openItemEditor = defineModal<Item, Item>({
  title: "品目の編集",
  size: "md",
  // 入力途中に外side クリックで消えると入力が飛ぶので、閉じさせない
  dismissible: false,
  content: ({ params, close }) => <ItemForm item={params} onSave={(next) => close(next)} onCancel={() => close()} />,
});

/** 編集モーダルの中身。**ふつうの React コンポーネント**でよい。 */
function ItemForm({ item, onSave, onCancel }: { item: Item; onSave: (item: Item) => void; onCancel: () => void }) {
  const [name, setName] = React.useState(item.name);
  const [note, setNote] = React.useState(item.note);
  const changed = name !== item.name || note !== item.note;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ ...label, margin: 0 }}>
        コード <code>{item.code}</code> を編集します。保存を押すまで一覧は変わりません。
      </p>
      <div style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 12, color: "var(--color-muted)" }}>品名</span>
        <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 12, color: "var(--color-muted)" }}>保管場所</span>
        <Input value={note} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
        <Button variant="secondary" onClick={onCancel}>やめる</Button>
        <Button disabled={!changed} onClick={() => onSave({ ...item, name, note })}>保存</Button>
      </div>
    </div>
  );
}

export default function Page() {
  const [items, setItems] = React.useState<Item[]>(INITIAL);
  const [log, setLog] = React.useState<string[]>([]);
  const record = (text: string) => setLog((prev) => [`${new Date().toLocaleTimeString("ja-JP")}  ${text}`, ...prev].slice(0, 8));

  /** 1. いちばん単純な形。 */
  const openBasic = async () => {
    await openModal({
      title: "お知らせ",
      content: () => (
        <p style={{ fontSize: 13.5, lineHeight: 1.9, margin: 0 }}>
          背景が薄く暗くなり、この小窓だけが操作できる状態になっています。
          <br />
          右上の ×・<code>Esc</code> キー・小窓の外側クリックのどれでも閉じられます。
        </p>
      ),
    });
    record("お知らせを閉じた");
  };

  /** 2. 値を渡して、結果を受け取る。 */
  const openConfirm = async () => {
    const target = items[0];
    if (target === undefined) return;
    const ok = await openModal<{ code: string }, boolean>({
      title: "品目の削除",
      params: { code: target.code },
      dismissible: false,
      content: ({ params }) => (
        <p style={{ fontSize: 13.5, lineHeight: 1.9, margin: 0 }}>
          <code>{params.code}</code> を削除します。<strong>元に戻せません。</strong>
        </p>
      ),
      footer: ({ close }) => (
        <>
          <Button variant="secondary" onClick={() => close(false)}>やめる</Button>
          <Button onClick={() => close(true)}>削除する</Button>
        </>
      ),
    });
    record(ok === true ? `削除を選んだ (${target.code})` : "削除をやめた");
  };

  /** 3. 重ねる。モーダルの中からモーダルを開く。 */
  const openNested = () => {
    void openModal({
      title: "1 枚目",
      content: () => (
        <div style={{ display: "grid", gap: 12 }}>
          <p style={{ ...label, margin: 0 }}>この上にもう 1 枚開けます。閉じると 1 枚目に戻ります。</p>
          <Button
            onClick={() => {
              void openModal({
                title: "2 枚目",
                size: "sm",
                content: () => <p style={{ fontSize: 13.5, margin: 0 }}>重なりました。Esc で 1 枚ずつ閉じます。</p>,
              });
            }}
          >
            2 枚目を開く
          </Button>
        </div>
      ),
    });
  };

  /** 4. 一覧の行から編集して、結果で一覧を更新する(実務でいちばん多い形)。 */
  const editItem = async (item: Item) => {
    const saved = await openItemEditor(item);
    if (saved === undefined) {
      record(`編集をやめた (${item.code})`);
      return;
    }
    setItems((prev) => prev.map((x) => (x.code === saved.code ? saved : x)));
    record(`保存した (${saved.code})`);
  };

  const openSize = (size: "sm" | "lg" | "full") => {
    void openModal({
      title: `大きさ: ${size}`,
      size,
      content: () => <p style={{ fontSize: 13.5, margin: 0 }}>中身の量に合わせて sm / md / lg / xl / full から選びます。</p>,
    });
  };

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 48px" }}>
      <div style={box}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>1. 基本の形</h2>
        <p style={label}>
          ボタンを押すと画面全体が薄く暗くなり、ポップアップが出ます。
          中身は <strong>アプリ側が自由に組めます</strong>(ここに書いたものがそのまま出ます)。
        </p>
        <Button onClick={() => void openBasic()}>ポップアップを開く</Button>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>2. 値を渡す・結果を受け取る</h2>
        <p style={label}>
          開くときに <code>params</code> を渡し、閉じるときに <code>close(値)</code> で返します。
          <strong>呼んだ側は結果を待てる</strong>ので、「はいなら削除する」を素直に書けます。
        </p>
        <Button onClick={() => void openConfirm()}>削除の確認を出す</Button>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>3. 一覧から編集する</h2>
        <p style={label}>
          行のボタンから編集用のポップアップを開き、<strong>保存された結果だけ</strong>一覧に反映します。
          この小窓は <code>dismissible: false</code> にしてあるので、外側クリックや Esc では閉じません
          (入力途中に消えると書いたものが飛ぶため)。
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((item) => (
            <div
              key={item.code}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius)" }}
            >
              <Badge variant="secondary">{item.code}</Badge>
              <span style={{ flex: 1, fontSize: 13.5 }}>{item.name}</span>
              <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{item.note}</span>
              <Button variant="secondary" onClick={() => void editItem(item)}>編集</Button>
            </div>
          ))}
        </div>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>4. 大きさ・重ね表示</h2>
        <p style={label}>
          横幅は 5 段階から選べます。モーダルの中からモーダルを開くこともできます
          (一覧 → 明細 → 確認、のような流れ)。
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={() => openSize("sm")}>小さく (sm)</Button>
          <Button variant="secondary" onClick={() => openSize("lg")}>大きく (lg)</Button>
          <Button variant="secondary" onClick={() => openSize("full")}>画面いっぱい (full)</Button>
          <Button onClick={openNested}>重ねて開く</Button>
        </div>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>結果の記録</h2>
        <p style={label}>上の操作で、呼んだ側が受け取った結果です。</p>
        <Separator />
        <div style={{ marginTop: 12, fontSize: 12.5, fontFamily: "var(--font-mono)", lineHeight: 2, color: "var(--color-muted)" }}>
          {log.length === 0 ? "まだ操作していません。" : log.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      </div>
    </main>
  );
}
