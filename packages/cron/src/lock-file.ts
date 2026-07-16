/**
 * ファイルベースのプロセス間ロック。Redis を使わず、単一ホスト上で複数プロセス
 * (RPA・バッチ・定期ジョブ等)を直列化したいときに使う。
 * 出典: 社内 membership-extender の Chromium 直列化ロックを、winston / Chromium 依存を排して一般化。
 *
 * 特徴: 保持者 PID の死活監視 + 最終更新時刻(stale)で死んだロックを自動回収する。
 * `LockStore`(cron の分散ロック抽象)にも適合するので、単一ホスト環境ではそのまま差し替えできる。
 * @packageDocumentation
 */
import { openSync, writeSync, closeSync, readFileSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { LockStore } from "./lock.js";

interface Holder {
  pid: number;
  label: string;
  ts: number;
}

/** ファイルロックの共通設定。 */
export interface FileLockOptions {
  /** これより古い保持者は死亡とみなし奪取(既定 5 分)。 */
  staleMs?: number;
  /** 現在の PID(テスト用に差し替え可能)。 */
  pid?: number;
  /** PID の死活確認(既定: process.kill(pid, 0))。 */
  isAlive?: (pid: number) => boolean;
  now?: () => number;
}

const defaultIsAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0); // シグナル 0 = 存在確認のみ
    return true;
  } catch {
    return false;
  }
};

function readHolder(lockFile: string): Holder | null {
  try {
    return JSON.parse(readFileSync(lockFile, "utf8")) as Holder;
  } catch {
    return null;
  }
}

/**
 * 1 度だけロック取得を試みる(待機しない)。取得できたら true。
 * 既に有効な保持者がいれば false。死んだ/古いロックは回収して再取得する。
 *
 * @param path ロックファイルのパス
 * @param options.ttlMs 有効期間
 * @returns 取得できたか(**取れなければ即座に false**。待たない)
 */
export function tryAcquireFileLock(lockFile: string, label: string, options: FileLockOptions = {}): boolean {
  const staleMs = options.staleMs ?? 5 * 60_000;
  const pid = options.pid ?? process.pid;
  const isAlive = options.isAlive ?? defaultIsAlive;
  const now = options.now ?? (() => Date.now());
  mkdirSync(dirname(lockFile), { recursive: true });
  try {
    const fd = openSync(lockFile, "wx"); // 排他作成(既存なら EEXIST)
    writeSync(fd, JSON.stringify({ pid, label, ts: now() } satisfies Holder));
    closeSync(fd);
    return true;
  } catch {
    const holder = readHolder(lockFile);
    const stale = !holder || now() - holder.ts > staleMs;
    const dead = !holder || !isAlive(holder.pid);
    if (stale || dead) {
      try {
        unlinkSync(lockFile);
      } catch {
        // 別プロセスが先に消した場合は無視
      }
      // 回収後にもう1度だけ試す
      try {
        const fd = openSync(lockFile, "wx");
        writeSync(fd, JSON.stringify({ pid, label, ts: now() } satisfies Holder));
        closeSync(fd);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

/**
 * 自分が保持しているロックだけを解放する(奪取された場合は触らない)。
 *
 * @param path ロックファイルのパス
 */
export function releaseFileLock(lockFile: string, options: { pid?: number } = {}): void {
  const pid = options.pid ?? process.pid;
  const holder = readHolder(lockFile);
  if (holder && holder.pid === pid) {
    try {
      unlinkSync(lockFile);
    } catch {
      // 解放失敗は stale 回収に任せる
    }
  }
}

/** 待機付き取得の設定。 */
export interface AcquireFileLockOptions extends FileLockOptions {
  /** 取得できるまで待つ最大時間(既定 3 分)。超過で例外。 */
  waitTimeoutMs?: number;
  /** ポーリング間隔(既定 1 秒)。 */
  pollMs?: number;
  /** 待機/回収時のログ(任意)。 */
  onWait?: (info: { label: string; heldBy?: string; heldPid?: number }) => void;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * ロックを取得し、解放用の関数を返す。取得できるまで待機し、超過時は例外。
 * @example
 * ```ts
 * const release = await acquireFileLock(".cache/rpa.lock", "point-sync");
 * try { await runRpa(); } finally { release(); }
 * ```
 *
 * @param path ロックファイルのパス
 * @param options.timeoutMs 待つ時間
 * @returns ロック
 * @throws タイムアウトした場合
 */
export async function acquireFileLock(lockFile: string, label: string, options: AcquireFileLockOptions = {}): Promise<() => void> {
  const waitTimeoutMs = options.waitTimeoutMs ?? 180_000;
  const pollMs = options.pollMs ?? 1_000;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? (() => Date.now());
  const pid = options.pid ?? process.pid;
  const deadline = now() + waitTimeoutMs;

  for (;;) {
    if (tryAcquireFileLock(lockFile, label, options)) {
      return () => releaseFileLock(lockFile, { pid });
    }
    if (now() > deadline) {
      const holder = readHolder(lockFile);
      throw new Error(`file lock timeout after ${waitTimeoutMs}ms (held by ${holder?.label ?? "?"} pid=${holder?.pid ?? "?"})`);
    }
    const holder = readHolder(lockFile);
    options.onWait?.({ label, ...(holder ? { heldBy: holder.label, heldPid: holder.pid } : {}) });
    await sleep(pollMs);
  }
}

/**
 * ファイルロックを {@link LockStore} として使う(単一ホストで cron の分散ロックを差し替える用途)。
 * key ごとにロックファイルを分ける(`<dir>/<key>.lock`)。ttlMs は stale 判定に使う。
 *
 * @param options.dir ロックファイルの置き場
 * @returns ロックストア(**単一サーバ向け**。複数サーバでは Redis 実装を使う)
 */
export function createFileLockStore(dir: string, options: FileLockOptions = {}): LockStore {
  const fileOf = (key: string): string => `${dir}/${key.replace(/[^A-Za-z0-9_-]/g, "_")}.lock`;
  return {
    acquire(key, ttlMs) {
      return tryAcquireFileLock(fileOf(key), key, { ...options, staleMs: ttlMs });
    },
    release(key) {
      releaseFileLock(fileOf(key), options);
    },
  };
}
