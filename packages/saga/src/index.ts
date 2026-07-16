/**
 * saga（補償トランザクション）。複数ステップの処理を順に実行し、途中で失敗したら完了済みステップを逆順で打ち消す。
 * 分散処理・外部API連携など「全体をDBトランザクションで囲えない」処理の一貫性を保つための基盤。
 * @packageDocumentation
 */

/** saga の 1 ステップ。run で前進、compensate で打ち消し（省略可）。 */
export interface SagaStep<C> {
  name: string;
  run(ctx: C): Promise<void> | void;
  /** run が成功した後に、後続の失敗で呼ばれる打ち消し処理。 */
  compensate?(ctx: C): Promise<void> | void;
}

/** saga 実行の結果。 */
export interface SagaResult {
  ok: boolean;
  /** 成功して確定したステップ名（ok=false のときは打ち消し済みなので空）。 */
  completed: string[];
  /** 打ち消しを実行したステップ名（失敗時、逆順）。 */
  compensated: string[];
  /** 失敗したステップ名。 */
  failedStep?: string;
  /** 失敗の原因。 */
  error?: unknown;
  /** 打ち消し中に発生したエラー（ステップ名→原因）。手動対応が必要。 */
  compensationErrors?: { step: string; error: unknown }[];
}

/**
 * ステップを順に実行する。あるステップが例外を投げたら、それ以前に成功したステップの compensate を逆順で実行する。
 * 打ち消し自体が失敗しても他の打ち消しは続行し、compensationErrors に記録する。
 *
 * @param steps ステップの配列
 * @param context 各ステップに渡す文脈
 * @returns 実行結果。**途中で失敗したら、成功済みのステップを逆順で補償する**(取り消せない副作用があるなら Saga には向かない)
 */
export async function runSaga<C>(steps: SagaStep<C>[], ctx: C): Promise<SagaResult> {
  const done: SagaStep<C>[] = [];
  for (const step of steps) {
    try {
      await step.run(ctx);
      done.push(step);
    } catch (error) {
      const compensated: string[] = [];
      const compensationErrors: { step: string; error: unknown }[] = [];
      // 逆順で打ち消し
      for (let i = done.length - 1; i >= 0; i--) {
        const s = done[i]!;
        if (!s.compensate) continue;
        try {
          await s.compensate(ctx);
          compensated.push(s.name);
        } catch (ce) {
          compensationErrors.push({ step: s.name, error: ce });
        }
      }
      return { ok: false, completed: [], compensated, failedStep: step.name, error, ...(compensationErrors.length > 0 ? { compensationErrors } : {}) };
    }
  }
  return { ok: true, completed: done.map((s) => s.name), compensated: [] };
}

/**
 * Saga のステップを組み立てる。
 *
 * **Saga パターン**: 複数のサービスにまたがる処理を、DB のトランザクションなしで
 * 整合させる方法。各ステップに**補償処理**(取り消し)を用意し、途中で失敗したら
 * 逆順に取り消していく。
 *
 * @param name ステップ名
 * @param execute 実行する処理
 * @param compensate **取り消す処理**(失敗時に逆順で呼ばれる)
 * @returns ステップ定義
 */
export function sagaStep<C>(name: string, run: (ctx: C) => Promise<void> | void, compensate?: (ctx: C) => Promise<void> | void): SagaStep<C> {
  return compensate ? { name, run, compensate } : { name, run };
}
