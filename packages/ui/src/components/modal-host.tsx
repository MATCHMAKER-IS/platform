"use client";
/**
 * **どこからでも開けるモーダル。** アプリのルートに {@link ModalHost} を 1 つ置き、
 * 任意の場所から {@link openModal} を呼ぶ(`Toaster` / `toast` と同じ作法)。
 *
 * 既存の {@link Dialog} との違いは「**開閉の状態を呼ぶ側が持たなくてよい**」ことだけ。
 * 見た目・薄い黒の覆い・×ボタン・Esc / 外側クリックで閉じる挙動はすべて Dialog のもので、
 * ここでは新しく作っていない(作ると 2 つの見た目が生まれ、直す場所が増える)。
 *
 * 使い分け:
 * - 画面の中に置いた要素から開く、状態も画面が持っている → `Dialog` / `Modal`
 * - **一覧の行・メニュー・通知・非同期処理の途中**から開く、結果を待ちたい → こちら
 *
 * @packageDocumentation
 */
import * as React from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "./dialog";
import { cn } from "../lib/cn";

/** モーダルの横幅。中身の量で選ぶ。 */
export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[min(96vw,1400px)]",
};

/**
 * モーダルの中身に渡される道具一式。
 *
 * @typeParam P 開くときに渡した値の型
 * @typeParam R 閉じるときに返す値の型
 */
export interface ModalContext<P, R> {
  /** {@link openModal} に渡した値。 */
  params: P;
  /**
   * 閉じる。渡した値が `openModal` の戻り値になる。
   *
   * **値を渡さずに閉じた場合と、×/Esc で閉じた場合は区別できない**(どちらも `undefined`)。
   * 「保存したか」を知りたいなら `close(true)` のように必ず値を渡すこと。
   */
  close: (result?: R) => void;
}

/**
 * 開くモーダルの指定。
 *
 * @typeParam P 中身に渡す値の型(既定は無し)
 * @typeParam R 閉じるときに返す値の型(既定は無し)
 */
export interface ModalSpec<P = void, R = void> {
  /** 見出し。省くと見出し行ごと出さない。 */
  title?: string;
  /** 中身。**アプリ側が自由に組む**(フォームでも表でも何でもよい)。 */
  content: (ctx: ModalContext<P, R>) => React.ReactNode;
  /** 下部の操作ボタン。省略可。 */
  footer?: (ctx: ModalContext<P, R>) => React.ReactNode;
  /** 中身に渡す値。 */
  params?: P;
  /** 横幅(既定 `md`)。 */
  size?: ModalSize;
  /**
   * ×・Esc・外側クリックで閉じてよいか(既定 `true`)。
   *
   * **入力途中に消えると困る画面では `false`** にして、フッタの「やめる」から
   * `close()` を呼ばせる(捨ててよいかを確認できる)。
   */
  dismissible?: boolean;
  /** 追加のクラス。角丸・余白などを変えたいときだけ。 */
  className?: string;
}

/** 表示中の 1 件(内部表現)。 */
interface ModalEntry {
  id: number;
  title?: string;
  size: ModalSize;
  dismissible: boolean;
  className?: string;
  render: (close: (result?: unknown) => void) => React.ReactNode;
  renderFooter?: (close: (result?: unknown) => void) => React.ReactNode;
  resolve: (result: unknown) => void;
}

/**
 * 表示中のモーダル(重ねられる)。
 *
 * 配列にしているのは、**モーダルの中からさらにモーダルを開く**ことがあるため
 * (一覧 → 明細 → 削除確認)。1 件だけ持つ作りにすると、後から必ず作り直しになる。
 */
let stack: readonly ModalEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

/** 空配列を使い回す。毎回新しい配列を返すと `useSyncExternalStore` が無限に再描画する。 */
const EMPTY: readonly ModalEntry[] = [];

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * モーダルを開き、閉じるまで待つ。
 *
 * {@link ModalHost} が置かれていないと**何も表示されないまま待ち続ける**ので、
 * アプリのルート(layout)に 1 つ置くこと。
 *
 * @param spec 何をどう出すか
 * @returns 閉じるときに渡した値。**×・Esc・外側クリックで閉じたときは `undefined`**
 *
 * @example
 * ```tsx
 * const ok = await openModal<{ code: string }, boolean>({
 *   title: "品目の削除",
 *   params: { code: item.code },
 *   dismissible: false,
 *   content: ({ params }) => <p>{params.code} を削除します。戻せません。</p>,
 *   footer: ({ close }) => (
 *     <>
 *       <Button variant="secondary" onClick={() => close(false)}>やめる</Button>
 *       <Button onClick={() => close(true)}>削除する</Button>
 *     </>
 *   ),
 * });
 * if (ok) await remove(item.code);
 * ```
 */
export function openModal<P = void, R = void>(spec: ModalSpec<P, R>): Promise<R | undefined> {
  return new Promise<R | undefined>((resolve) => {
    const id = nextId++;
    // params はここで閉じ込める。以降 P / R を引きずらないので、
    // 保持する側(stack)は型引数なしで扱えて `any` が要らない。
    const ctxFor = (close: (result?: unknown) => void): ModalContext<P, R> => ({
      params: spec.params as P,
      close: (result?: R) => close(result),
    });

    stack = [
      ...stack,
      {
        id,
        title: spec.title,
        size: spec.size ?? "md",
        dismissible: spec.dismissible ?? true,
        className: spec.className,
        render: (close) => spec.content(ctxFor(close)),
        renderFooter: spec.footer ? (close) => spec.footer!(ctxFor(close)) : undefined,
        // 呼び出し側が待っている Promise を解く。R かどうかは openModal の型引数が保証する
        resolve: (result: unknown) => resolve(result as R | undefined),
      },
    ];
    emit();
  });
}

/** 指定 ID を閉じて、待っている呼び出し元に値を返す。 */
function dismiss(id: number, result: unknown): void {
  const entry = stack.find((e) => e.id === id);
  if (entry === undefined) return; // 二重に閉じられた場合(×とフッタの同時押下など)
  stack = stack.filter((e) => e.id !== id);
  emit();
  entry.resolve(result);
}

/**
 * いちばん上のモーダルを閉じる。
 *
 * 画面遷移やログアウトなど、**開いたのとは別の都合で畳みたい**ときに使う。
 * 通常は中身から `close()` を呼ぶ方がよい(どの値を返すか書けるため)。
 *
 * @param result 呼び出し元に返す値(既定 `undefined`)
 */
export function closeModal(result?: unknown): void {
  const top = stack[stack.length - 1];
  if (top !== undefined) dismiss(top.id, result);
}

/**
 * 開いているモーダルをすべて閉じる。
 *
 * 待っている呼び出し元には `undefined` が返る(=「選ばずに終わった」)。
 */
export function closeAllModals(): void {
  const open = stack;
  stack = EMPTY;
  emit();
  for (const entry of open) entry.resolve(undefined);
}

/**
 * 同じモーダルを**名前を付けて使い回す**ための定義。
 *
 * 呼ぶ場所ごとに `content` を書くと、同じ小窓なのに少しずつ違うものが増える。
 * 1 度定義して配れば、**呼ぶ側は値を渡すだけ**になり、型も効く。
 *
 * @param spec `params` 以外を決めた雛形
 * @returns 値を渡して開く関数
 *
 * @example
 * ```tsx
 * // 定義(1 箇所)
 * export const openItemDetail = defineModal<{ code: string }, "saved" | "deleted">({
 *   title: "品目の詳細",
 *   size: "lg",
 *   content: ({ params, close }) => <ItemDetail code={params.code} onSaved={() => close("saved")} />,
 * });
 *
 * // 呼ぶ(どこからでも)
 * const r = await openItemDetail({ code: "A-001" });
 * if (r === "saved") await reload();
 * ```
 */
export function defineModal<P = void, R = void>(
  spec: Omit<ModalSpec<P, R>, "params">,
): (params: P) => Promise<R | undefined> {
  return (params: P) => openModal<P, R>({ ...spec, params });
}

/**
 * モーダルの置き場。**アプリのルートに 1 つだけ**置く。
 *
 * ここに置かないと {@link openModal} は何も表示しない。`Toaster` と同じで、
 * 「出す場所」と「呼ぶ場所」を分けることで、どの画面からでも呼べるようにしている。
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * <body>
 *   {children}
 *   <ModalHost />
 * </body>
 * ```
 */
export function ModalHost() {
  const open = React.useSyncExternalStore(
    subscribe,
    () => stack,
    // サーバ描画では常に空。開いた状態を SSR しても、クライアントで開き直すことはできない
    () => EMPTY,
  );

  return (
    <>
      {open.map((entry) => (
        <Dialog
          key={entry.id}
          open
          onOpenChange={(next) => {
            // Radix が閉じようとしたとき(× / Esc / 外側クリック)。
            // dismissible=false なら無視する = 中身の操作でしか閉じられない
            if (!next && entry.dismissible) dismiss(entry.id, undefined);
          }}
        >
          <DialogContent
            className={cn(SIZE_CLASS[entry.size], entry.className)}
            // 閉じさせない設定のときは、外側クリックと Esc を止める
            onPointerDownOutside={(e) => {
              if (!entry.dismissible) e.preventDefault();
            }}
            onEscapeKeyDown={(e) => {
              if (!entry.dismissible) e.preventDefault();
            }}
          >
            {entry.title !== undefined && (
              <DialogHeader>
                <DialogTitle>{entry.title}</DialogTitle>
              </DialogHeader>
            )}
            {entry.render((result) => dismiss(entry.id, result))}
            {entry.renderFooter !== undefined && (
              <DialogFooter>{entry.renderFooter((result) => dismiss(entry.id, result))}</DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      ))}
    </>
  );
}
