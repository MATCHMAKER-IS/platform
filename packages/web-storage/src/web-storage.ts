/**
 * 端末に残す設定・下書き(localStorage / sessionStorage)。
 *
 * ブラウザの Web Storage は「使うだけ」なら 1 行だが、**素で書くと必ず同じ 4 つを踏む**。
 * この基盤でも 28 ファイルが個別に書いており、対処の抜けが場所ごとに違っていた。
 *
 * 1. **サーバ側には存在しない。** Next.js はコンポーネントをサーバでも実行するので、
 *    `localStorage.getItem()` を素で書くと `ReferenceError` で画面が落ちる。
 * 2. **書き込みは失敗しうる。** Safari のプライベートモードは `setItem` で例外を投げ、
 *    容量(概ね 5MB)を超えても例外になる。囲っていないと
 *    **設定を保存しようとしただけでアプリが止まる**。
 * 3. **入っている JSON が古い形のことがある。** 型を変えて再デプロイしても、
 *    利用者の端末には**前の形が残ったまま**。`as T` で信じると
 *    「昨日まで動いていた人だけが落ちる」という最も追いにくい壊れ方をする。
 * 4. **同じオリジンで鍵がぶつかる。** 複数のアプリを同じドメインに載せると、
 *    `"theme"` のような素朴な鍵は取り合いになる。
 *
 * 【この実装の立場】
 * **読み取りは例外を投げない**(取れなければ既定値)。描画中に読むものなので、
 * 失敗で描画を止める価値がない。一方**書き込みは `Result` を返す**。
 * 容量超過は利用者に伝えるべき失敗で、黙って捨てると
 * 「保存したのに消えている」になる。
 *
 * @packageDocumentation
 */
import { AppError, ErrorCode, err, ok, type Result } from "@platform/core";

/**
 * 保存先。`localStorage` と `sessionStorage` の共通部分だけを要求する。
 *
 * **DOM の `Storage` 型を使わない**のは、共通 tsconfig の `lib` が `["ES2022"]` で
 * DOM を含まず、サーバ側から型検査されると `TS2304` で落ちるため。
 */
export interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

/** どちらの保存先を使うか。 */
export type StorageKind = "local" | "session";

/** {@link createWebStorage} の設定。 */
export interface WebStorageOptions<T> {
  /**
   * 鍵。**接頭辞と版が自動で付く**ので短い名前を書く
   * (`"theme"` → 実際の鍵は `"internal-app:v1:theme"`)。
   */
  key: string;
  /** 取り出せなかったときに返す値。**必ず指定する**(読み取りを失敗しない形にするため)。 */
  fallback: T;
  /**
   * 保存されていた値が**期待する形か**を確かめる。
   *
   * 型を変えて再デプロイしても利用者の端末には前の形が残る。
   * ここで弾かないと `as T` と同じで、古い形が画面に流れ込む。
   */
  validate?: (value: unknown) => value is T;
  /** 鍵の接頭辞(既定 `"app"`)。同じオリジンに複数アプリを載せるとき分ける。 */
  namespace?: string;
  /**
   * 形の版(既定 1)。**上げると古い鍵は読まれなくなる**(鍵に含まれるため)。
   * `validate` を書きにくい複雑な形のときの逃げ道。
   */
  version?: number;
  /** local(既定・端末に残る)か session(タブを閉じると消える)か。 */
  kind?: StorageKind;
  /** 保存先の注入(テスト・SSR 用)。省略時は `kind` に応じた本物を探す。 */
  storage?: WebStorageLike;
  /** 保存から一定時間で無効にする(ミリ秒)。下書きの保持に使う。 */
  ttlMs?: number;
  /** 現在時刻(テスト注入用。既定は `Date.now`)。 */
  now?: () => number;
}

/** 保存する中身。時刻を値と一緒に持つ(TTL の判定に使う)。 */
interface Envelope {
  /** 保存した時刻(epoch ミリ秒)。 */
  t: number;
  /** 値。 */
  v: unknown;
}

/** 端末に残す設定・下書きの読み書き。 */
export interface WebStore<T> {
  /**
   * 読む。**失敗しても例外を投げず `fallback` を返す。**
   *
   * 取れないのはサーバ側 / 未保存 / JSON が壊れている / 形が違う / TTL 切れ
   * のいずれか。呼び出し側が区別する必要はまず無いので分けていない。
   */
  get(): T;
  /**
   * 書く。
   *
   * @returns 成功したか。容量超過・プライベートモード・サーバ側では失敗
   */
  set(value: T): Result<void>;
  /** 消す。 */
  remove(): void;
  /**
   * 他のタブでの変更を受け取る。
   *
   * テーマを 1 つのタブで変えたとき、**他のタブが古い表示のまま残る**のを防ぐ。
   *
   * @param onChange 変更後の値(消された場合は `fallback`)
   * @returns 購読を解除する関数。**`useEffect` の戻り値にそのまま返せる**
   */
  subscribe(onChange: (value: T) => void): () => void;
  /** 実際に使われる鍵(接頭辞と版を含む)。移行・デバッグ用。 */
  readonly resolvedKey: string;
}

/**
 * 本物の保存先を探す。**サーバ側では `null`。**
 *
 * `typeof window` ではなく保存先そのものを見るのは、window はあるが
 * storage が無い環境(一部のテスト環境)があるため。
 * また、Cookie を全面的に拒否する設定では**参照した時点で例外**になるので囲う。
 */
function resolveStorage(kind: StorageKind): WebStorageLike | null {
  try {
    const g = globalThis as unknown as Record<string, WebStorageLike | undefined>;
    const s = kind === "local" ? g["localStorage"] : g["sessionStorage"];
    return s !== undefined && typeof s.getItem === "function" ? s : null;
  } catch {
    return null;
  }
}

/**
 * 端末に残す値を 1 つ扱うストアを作る。
 *
 * **鍵ひとつにつき 1 つ作る**。モジュールの外に出しておくと、
 * 鍵の重複や既定値の食い違いが起きにくい。
 *
 * @param options 鍵・既定値・形の検証など
 * @returns 読み書き・購読ができるストア
 *
 * @example
 * ```ts
 * type Theme = "light" | "dark" | "system";
 * const themeStore = createWebStorage<Theme>({
 *   key: "theme",
 *   fallback: "system",
 *   validate: (v): v is Theme => v === "light" || v === "dark" || v === "system",
 *   namespace: "internal-app",
 * });
 *
 * const theme = themeStore.get();        // サーバ側でも安全("system" が返る)
 * const saved = themeStore.set("dark");
 * if (!saved.ok) toast.error("設定を保存できませんでした(空き容量を確認してください)");
 * ```
 */
export function createWebStorage<T>(options: WebStorageOptions<T>): WebStore<T> {
  const {
    key,
    fallback,
    validate,
    namespace = "app",
    version = 1,
    kind = "local",
    ttlMs,
    now = Date.now,
  } = options;

  const resolvedKey = `${namespace}:v${version}:${key}`;
  // 保存先は毎回引き直す。モジュールの評価はサーバで先に起きるため、
  // ここで固定すると**ブラウザに渡っても null のまま**になる
  const target = (): WebStorageLike | null => options.storage ?? resolveStorage(kind);

  /** 生の文字列を値に戻す。戻せなければ null。 */
  const decode = (raw: string | null): { value: T } | null => {
    if (raw === null) return null;
    let env: Envelope;
    try {
      env = JSON.parse(raw) as Envelope;
    } catch {
      return null; // 手で書き換えられた / 別のものが同じ鍵を使った
    }
    if (typeof env !== "object" || env === null || !("v" in env)) return null;
    if (ttlMs !== undefined && now() - env.t > ttlMs) return null;
    // **形が違うものは無かったことにする。** 古い形が画面に流れ込むと、
    // 「その端末の人だけ落ちる」という追いにくい壊れ方をする
    if (validate !== undefined && !validate(env.v)) return null;
    return { value: env.v as T };
  };

  return {
    resolvedKey,

    get(): T {
      const s = target();
      if (s === null) return fallback;
      try {
        return decode(s.getItem(resolvedKey))?.value ?? fallback;
      } catch {
        return fallback;
      }
    },

    set(value: T): Result<void> {
      const s = target();
      // サーバ側での呼び出しは**誤りではなく、単にできない**。
      // 例外にすると呼ぶ側が毎回 typeof window を書くことになる
      if (s === null) {
        return err(new AppError(ErrorCode.CONFIG, "保存先が使えません(サーバ側、または保存が無効)"));
      }
      const env: Envelope = { t: now(), v: value };
      try {
        s.setItem(resolvedKey, JSON.stringify(env));
        return ok(undefined);
      } catch (cause) {
        return err(new AppError(
          ErrorCode.CONFLICT,
          "保存できませんでした(容量超過、またはプライベートモード)",
          { cause },
        ));
      }
    },

    remove(): void {
      const s = target();
      if (s === null) return;
      try { s.removeItem(resolvedKey); } catch { /* 消せなくても続行 */ }
    },

    subscribe(onChange: (value: T) => void): () => void {
      const g = globalThis as unknown as {
        addEventListener?: (t: string, h: (e: unknown) => void) => void;
        removeEventListener?: (t: string, h: (e: unknown) => void) => void;
      };
      // サーバ側やイベントを持たない環境では**何もしない購読**を返す。
      // null を返すと呼ぶ側が毎回分岐を書くことになる
      if (typeof g.addEventListener !== "function") return () => { /* noop */ };

      const handler = (e: unknown): void => {
        const ev = e as { key?: string | null; newValue?: string | null };
        // key が null なのは clear() されたとき。その場合も既定値へ戻す
        if (ev.key !== null && ev.key !== undefined && ev.key !== resolvedKey) return;
        onChange(decode(ev.newValue ?? null)?.value ?? fallback);
      };
      g.addEventListener("storage", handler);
      return () => g.removeEventListener?.("storage", handler);
    },
  };
}

/**
 * 接頭辞に合う鍵をまとめて消す。
 *
 * ログアウト時に**その利用者の下書きだけ**を消す、といった用途。
 * `clear()` は同じオリジンの他のアプリの分まで消すので使わない。
 *
 * @param namespace 接頭辞(`createWebStorage` に渡したもの)
 * @param kind local(既定)か session か
 * @param storage 保存先の注入(テスト用)
 * @returns 消した件数
 *
 * @example
 * ```ts
 * clearNamespace("internal-app");   // ログアウト時
 * ```
 */
export function clearNamespace(
  namespace: string,
  kind: StorageKind = "local",
  storage?: WebStorageLike,
): number {
  const s = storage ?? resolveStorage(kind);
  if (s === null) return 0;
  const prefix = `${namespace}:`;
  // **消しながら走査しない。** removeItem で索引がずれ、1 つ飛ばしになる
  const doomed: string[] = [];
  try {
    for (let i = 0; i < s.length; i += 1) {
      const k = s.key(i);
      if (k !== null && k.startsWith(prefix)) doomed.push(k);
    }
    for (const k of doomed) s.removeItem(k);
  } catch {
    return 0;
  }
  return doomed.length;
}

/**
 * テスト・SSR 用のメモリ実装。
 *
 * `WebStorageLike` を満たすので `storage` に注入できる。
 * **ブラウザ以外でも同じコードを通せる**ようにするためのもの。
 *
 * @returns メモリ上の保存先
 *
 * @example
 * ```ts
 * const store = createWebStorage({ key: "k", fallback: 0, storage: createMemoryWebStorage() });
 * ```
 */
export function createMemoryWebStorage(): WebStorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
}
