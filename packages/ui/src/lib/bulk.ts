/**
 * **一括操作と、その取り消し。**
 *
 * 【なぜ必要か】
 * **100 人規模では、承認者の負担が最初に限界を迎えます。**
 * 月末に 100 件の申請が上がってきて、**1 件ずつ押す**のは現実的でありません。
 *
 * **ただし一括は事故が大きい**です。
 * 「全選択 → 却下」を押し間違えると、**100 件が一度に却下**されます。
 *
 * **だから取り消しと必ず組にしてください。**
 * このファイルは**その 2 つを一緒に**扱います。
 *
 * 【設計の考え方】
 * **「本当に実行しますか？」の確認だけでは足りません。**
 * 人は確認を読まずに押します——**押した後に戻せる**方が確実です。
 *
 * @packageDocumentation
 */

/** 一括操作の結果（1 件分）。 */
export interface BulkItemResult {
  /** 対象の鍵。 */
  key: string;
  /** 成功したか。 */
  ok: boolean;
  /** 失敗した理由。 */
  error?: string;
  /**
   * **元に戻すための情報**（成功したときだけ）。
   *
   * **変更前の値**を入れてください——「`status` は `pending` だった」。
   * これが無いと、**取り消しようがありません**。
   * そのまま {@link createUndoStack} の `register` に渡せます。
   */
  undoData?: unknown;
}

/** 一括操作の結果。 */
export interface BulkResult {
  /** 成功した数。 */
  succeeded: number;
  /** 失敗した数。 */
  failed: number;
  /** 1 件ずつの結果。 */
  items: BulkItemResult[];
  /**
   * **取り消しに使う券**。
   *
   * **失敗した分は含みません**——成功したものだけが戻せます。
   */
  undoToken?: string;
}

/**
 * **一括で実行する。**
 *
 * 【1 件ずつ実行します】
 * **まとめて 1 回の呼び出しにはしません。**
 * 1 件が失敗したときに、**どれが通ってどれが落ちたか**が分からなくなるためです。
 *
 * 【途中で止めません】
 * 3 件目が失敗しても、**4 件目以降は続けます**——
 * **止めると「どこまで進んだか」を人が調べる**ことになります。
 * 全部試して、**失敗したものだけを見せる**方が親切です。
 *
 * 【同時には走らせません】
 * **順番に実行します。** 同時に走らせると速いですが、
 * **DB のロック待ちが増えて、かえって遅くなる**ことがあります。
 * **100 件程度なら順番で十分**です。
 *
 * @param keys 対象の鍵
 * @param execute 1 件を実行する
 * @param options `onProgress`（進み具合を知らせる）
 * @returns 実行の結果
 */
export async function runBulk(
  keys: readonly string[],
  execute: (key: string) => Promise<void>,
  options: { onProgress?: (done: number, total: number) => void } = {},
): Promise<BulkResult> {
  const items: BulkItemResult[] = [];

  for (const key of keys) {
    try {
      await execute(key);
      items.push({ key, ok: true });
    } catch (e) {
      // **途中で止めない。** 止めると
      // **「どこまで進んだか」を人が調べる**ことになります。
      items.push({ key, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    options.onProgress?.(items.length, keys.length);
  }

  return {
    succeeded: items.filter((i) => i.ok).length,
    failed: items.filter((i) => !i.ok).length,
    items,
  };
}

/** 取り消せる操作の記録。 */
interface UndoEntry {
  token: string;
  /** 何をしたか（画面に出します）。 */
  label: string;
  /** 戻す対象（**成功した分だけ**）。 */
  keys: string[];
  /** 戻す処理。 */
  revert: (keys: readonly string[]) => Promise<void>;
  /** いつまで戻せるか。 */
  expiresAt: number;
  /** すでに戻したか。 */
  reverted: boolean;
}

/**
 * **取り消せるようにする器。**
 *
 * 【期限を必ず入れてください】
 * **いつまでも戻せるのは危険**です。
 * 「30 分前の却下を取り消したら、その間に別の人が承認していた」——
 * **後から入った変更を壊します**。
 *
 * **既定は 5 分**。押し間違いに気づくには十分で、
 * **他の人の作業を壊すには短すぎる**長さです。
 *
 * 【1 回しか戻せません】
 * 連打で**二度戻る**ことを防ぎます——
 * 「却下を取り消して、また取り消す」は意味を成しません。
 *
 * 【保存先について】
 * **これはメモリ実装です。** 再起動すると戻せなくなります——
 * **それでよい**と考えています。5 分の期限なので、
 * **再起動をまたぐ取り消しは、そもそも危ない**からです。
 *
 * @param options `ttlMs`（既定 5 分）
 * @returns 取り消しを管理する器
 */
export function createUndoStack(options: { ttlMs?: number } = {}): {
  /**
   * 戻せるように記録する。
   *
   * **成功した分だけ**を渡してください——
   * **失敗したものを戻そうとすると、また失敗**します。
   */
  register(input: {
    label: string;
    keys: readonly string[];
    revert: (keys: readonly string[]) => Promise<void>;
  }): string;
  /** 戻せるもの（**期限内で、まだ戻していないもの**）。 */
  available(now?: number): { token: string; label: string; count: number }[];
  /** 戻す。 */
  undo(token: string): Promise<{ ok: boolean; reason?: string }>;
  /** 期限切れを片付ける。 */
  sweep(now?: number): number;
} {
  const ttlMs = options.ttlMs ?? 5 * 60 * 1000;
  const entries = new Map<string, UndoEntry>();
  let seq = 0;

  return {
    register({ label, keys, revert }) {
      seq += 1;
      const token = `undo-${seq}`;
      entries.set(token, {
        token, label, keys: [...keys], revert,
        expiresAt: Date.now() + ttlMs,
        reverted: false,
      });
      return token;
    },

    available(now = Date.now()) {
      return [...entries.values()]
        .filter((e) => !e.reverted && e.expiresAt > now)
        .map((e) => ({ token: e.token, label: e.label, count: e.keys.length }));
    },

    async undo(token) {
      const entry = entries.get(token);
      if (entry === undefined) return { ok: false, reason: "取り消せる操作が見つかりません" };
      // **1 回しか戻せません。** 連打で二度戻るのを防ぎます
      if (entry.reverted) return { ok: false, reason: "すでに取り消しています" };
      if (entry.expiresAt <= Date.now()) {
        // **期限切れは戻させない。** その間に別の人が変更しているかもしれず、
        // **後から入った変更を壊します**。
        return { ok: false, reason: "取り消せる時間を過ぎました" };
      }
      // **先に印を付ける。** 戻す処理の途中でもう一度押されても、
      // **二重に戻らない**ようにするためです。
      entry.reverted = true;
      try {
        await entry.revert(entry.keys);
        return { ok: true };
      } catch (e) {
        // **失敗したら印を戻す。** もう一度試せるようにするためです
        entry.reverted = false;
        return {
          ok: false,
          reason: `取り消しに失敗しました: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    },

    sweep(now = Date.now()) {
      let removed = 0;
      for (const [token, e] of entries) {
        if (e.expiresAt <= now) {
          entries.delete(token);
          removed += 1;
        }
      }
      return removed;
    },
  };
}

/**
 * **一括操作の前に見せる確認文**を作る。
 *
 * 【なぜ文言を揃えるか】
 * **画面ごとに違う言い方をすると、利用者は読まなくなります。**
 * 「本当によろしいですか？」が毎回出れば、**中身を見ずに押します**。
 *
 * **件数と対象を必ず入れてください**——
 * **数が目に入れば、100 件を 1 件と間違えたときに気づけます**。
 *
 * @param input 何を、何件、どうするか
 * @returns 確認に出す文
 */
export function bulkConfirmMessage(input: {
  /** 対象の呼び名（「経費申請」）。 */
  subject: string;
  /** 件数。 */
  count: number;
  /** 何をするか（「却下」）。 */
  action: string;
  /** 取り消せるか。 */
  undoable?: boolean;
}): string {
  const lines = [`${input.subject} ${input.count} 件を${input.action}します。`];
  if (input.undoable === true) {
    // **戻せることを伝える。** 伝えないと、
    // **押すのをためらって業務が止まります**。
    lines.push("**5 分以内なら取り消せます。**");
  } else {
    // **戻せないことも必ず伝える。** 「戻せると思っていた」が一番困ります
    lines.push("**この操作は取り消せません。**");
  }
  return lines.join("\n");
}
