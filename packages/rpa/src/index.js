/**
 * RPA 安全実行の共通部品(ランナー骨格)。
 *
 * 基盤は RPA 本体(ブラウザ自動操作など)は持たない。壁打ちの優先順位は **API > MCP > RPA** で、
 * RPA は最後の手段。だが RPA を回すときに毎回必要になる「安全に実行するための枠組み」——
 * 直列化(同一リソースの同時実行防止)・リトライ・監査記録・タイムアウト・冪等キー——を共通化する。
 *
 * 実際のロック実装は注入する(単一ホストなら @platform/cron の createFileLockStore、
 * 複数インスタンスなら createRedisLockStore)。監査シンクも注入する(@platform/audit 等)。
 * これにより本パッケージは外部依存ゼロ(core のみ)で、環境非依存にテストできる。
 * @packageDocumentation
 */
import { AppError, ErrorCode, ok, err } from "@platform/core";
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * RPA ランナーを作る。返り値の `run` は、直列化・冪等・タイムアウト・リトライ・監査を
 * まとめて面倒みる。RPA 本体(task.run)はビジネスロジックだけ書けばよい。
 *
 * @example
 * ```ts
 * import { createFileLockStore } from "@platform/cron";
 * const runner = createRpaRunner({ lock: createFileLockStore(".cache/rpa"), audit: sink });
 * const res = await runner.run({
 *   name: "point-sync",
 *   lockKey: "chromium",         // 他のブラウザ RPA と直列化
 *   timeoutMs: 120_000,
 *   retry: { maxAttempts: 3 },
 *   idempotencyKey: "2025-01-daily",
 *   run: async (ctx) => {
 *     await ctx.audit("open_browser");
 *     if (ctx.signal.aborted) return;
 *     // ... 実処理 ...
 *   },
 * });
 * ```
 * @param options.browser ブラウザの実装(**Playwright などを注入**)
 * @param options.timeoutMs 各操作のタイムアウト
 */
export function createRpaRunner(options = {}) {
    const now = options.now ?? (() => Date.now());
    const sleep = options.sleep ?? defaultSleep;
    const genRunId = options.genRunId ?? (() => `run_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
    async function emit(event) {
        if (options.audit)
            await options.audit(event);
    }
    return {
        async run(task) {
            const runId = genRunId();
            const baseMeta = { task: task.name, runId };
            // 冪等スキップ
            if (task.idempotencyKey && options.seenStore) {
                if (await options.seenStore.has(task.idempotencyKey)) {
                    await emit({ action: "rpa.skip", target: task.name, ...(options.actor ? { actor: options.actor } : {}), at: new Date(now()).toISOString(), metadata: { ...baseMeta, idempotencyKey: task.idempotencyKey } });
                    return ok({ runId, attempts: 0, skipped: true, value: undefined });
                }
            }
            // ロック確保(直列化)
            let locked = false;
            if (task.lockKey && options.lock) {
                const ttl = task.lockTtlMs ?? 5 * 60_000;
                const waitDeadline = now() + (task.lockWaitMs ?? 0);
                for (;;) {
                    locked = await options.lock.acquire(task.lockKey, ttl);
                    if (locked)
                        break;
                    if (now() >= waitDeadline) {
                        await emit({ action: "rpa.lock_timeout", target: task.name, at: new Date(now()).toISOString(), metadata: { ...baseMeta, lockKey: task.lockKey } });
                        return err(new AppError(ErrorCode.CONFLICT, `RPA タスク ${task.name} はロック ${task.lockKey} を取得できませんでした`));
                    }
                    await sleep(Math.min(1000, Math.max(0, waitDeadline - now())));
                }
            }
            const signal = { aborted: false };
            let timer;
            if (task.timeoutMs !== undefined) {
                timer = setTimeout(() => { signal.aborted = true; }, task.timeoutMs);
            }
            const maxAttempts = Math.max(1, task.retry?.maxAttempts ?? 1);
            const baseDelay = task.retry?.baseDelayMs ?? 1000;
            const isRetryable = task.retry?.isRetryable ?? (() => true);
            try {
                let lastError;
                for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                    const ctx = {
                        runId,
                        attempt,
                        signal,
                        audit: (action, metadata) => emit({ action, target: task.name, ...(options.actor ? { actor: options.actor } : {}), at: new Date(now()).toISOString(), metadata: { ...baseMeta, attempt, ...(metadata ?? {}) } }),
                    };
                    await emit({ action: "rpa.start", target: task.name, ...(options.actor ? { actor: options.actor } : {}), at: new Date(now()).toISOString(), metadata: { ...baseMeta, attempt } });
                    try {
                        const value = await task.run(ctx);
                        if (signal.aborted) {
                            await emit({ action: "rpa.timeout", target: task.name, at: new Date(now()).toISOString(), metadata: { ...baseMeta, attempt } });
                            return err(new AppError(ErrorCode.INTERNAL, `RPA タスク ${task.name} がタイムアウトしました`, { details: { runId } }));
                        }
                        if (task.idempotencyKey && options.seenStore)
                            await options.seenStore.add(task.idempotencyKey);
                        await emit({ action: "rpa.success", target: task.name, at: new Date(now()).toISOString(), metadata: { ...baseMeta, attempt } });
                        return ok({ runId, attempts: attempt, skipped: false, value });
                    }
                    catch (e) {
                        lastError = e;
                        const message = e instanceof Error ? e.message : String(e);
                        await emit({ action: "rpa.error", target: task.name, at: new Date(now()).toISOString(), metadata: { ...baseMeta, attempt, error: message } });
                        if (signal.aborted) {
                            return err(new AppError(ErrorCode.INTERNAL, `RPA タスク ${task.name} がタイムアウトしました`, { details: { runId } }));
                        }
                        if (attempt < maxAttempts && isRetryable(e)) {
                            await sleep(baseDelay * 2 ** (attempt - 1));
                            continue;
                        }
                        break;
                    }
                }
                const message = lastError instanceof Error ? lastError.message : String(lastError);
                return err(new AppError(ErrorCode.EXTERNAL, `RPA タスク ${task.name} が失敗しました: ${message}`, { details: { runId, attempts: maxAttempts } }));
            }
            finally {
                if (timer)
                    clearTimeout(timer);
                if (locked && task.lockKey && options.lock)
                    await options.lock.release(task.lockKey);
            }
        },
    };
}
//# sourceMappingURL=index.js.map