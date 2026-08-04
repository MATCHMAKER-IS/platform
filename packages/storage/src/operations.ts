/**
 * ストレージのファイル操作（コピー・移動・整理）。
 *
 * `Storage` は保存・取得・削除という**最小限**しか持たない。
 * これは意図的で、実装（S3・ローカル・メモリ）を増やしやすくするため。
 *
 * だが実務では次の操作が頻繁に要る:
 *
 *   - **コピー**（テンプレートから複製する）
 *   - **移動**（承認された書類を `draft/` から `approved/` へ）
 *   - **一括削除**（退職者の一時ファイルをまとめて消す）
 *   - **容量の確認**（誰がどれだけ使っているか）
 *
 * ここでは**既存の操作を組み合わせて**実現する。
 * `StorageAdapter` を増やさないので、**実装を足すときの負担が変わらない**。
 *
 * 【注意：原子的ではない】
 * コピーは「取得 → 保存」、移動は「取得 → 保存 → 削除」で実現している。
 * 途中で失敗すると**中途半端な状態**になる:
 *
 *   - コピーの途中で失敗 → 元は残る（**安全側**）
 *   - 移動の途中で失敗 → 両方に残る（**元を消す前に保存を確認する**）
 *
 * S3 のようにサーバ側コピーができる実装なら、そちらの方が速く確実。
 * この実装は**どの実装でも動く共通の下限**として用意している。
 *
 * @packageDocumentation
 */
import { AppError, ErrorCode, err, type Result } from "@platform/core";
import type { Storage } from "./index";

/** 一括操作の結果。 */
export interface BatchResult {
  /** 成功した件数。 */
  succeeded: number;
  /** 失敗したキーと理由（**黙って飛ばさない**）。 */
  failed: { key: string; message: string }[];
}

/**
 * ファイルをコピーする。
 *
 * **取得して保存し直す**ので、大きなファイルでは記憶域を使う。
 * S3 のようにサーバ側コピーができる実装なら、そちらを使う方が速い。
 *
 * @param storage ストレージ
 * @param from コピー元のキー
 * @param to コピー先のキー
 * @param options.overwrite 既にあるとき上書きするか（**既定 false**。事故を防ぐ）
 * @returns 成功なら `void`
 *
 * @example
 * ```ts
 * // テンプレートから複製
 * await copyFile(storage, "templates/invoice.xlsx", "drafts/invoice-1001.xlsx");
 * ```
 */
export async function copyFile(
  storage: Storage,
  from: string,
  to: string,
  options: { overwrite?: boolean } = {},
): Promise<Result<void>> {
  if (from === to) {
    return { ok: true, value: undefined };
  }

  // **既定では上書きしない。** 同じ名前で上書きして元に戻せなくなる事故を防ぐ
  if (options.overwrite !== true) {
    const exists = await storage.exists(to);
    if (!exists.ok) return exists;
    if (exists.value) {
      return err(new AppError(
        ErrorCode.CONFLICT,
        `コピー先に既にファイルがあります: ${to}（上書きするなら overwrite: true）`,
      ));
    }
  }

  const body = await storage.get(from);
  if (!body.ok) return body;
  return storage.put(to, body.value);
}

/**
 * ファイルを移動する（名前を変える）。
 *
 * **保存が成功してから元を消す**。逆にすると、保存に失敗したときに
 * ファイルが消えてなくなる。
 *
 * @param storage ストレージ
 * @param from 移動元のキー
 * @param to 移動先のキー
 * @param options.overwrite 既にあるとき上書きするか（既定 false）
 * @returns 成功なら `void`
 *
 * @example
 * ```ts
 * // 承認されたので draft から approved へ
 * await moveFile(storage, "draft/contract-1.pdf", "approved/contract-1.pdf");
 * ```
 */
export async function moveFile(
  storage: Storage,
  from: string,
  to: string,
  options: { overwrite?: boolean } = {},
): Promise<Result<void>> {
  if (from === to) return { ok: true, value: undefined };

  const copied = await copyFile(storage, from, to, options);
  if (!copied.ok) return copied;

  // **保存を確認してから消す。** 逆にするとファイルが消えてなくなる
  return storage.delete(from);
}

/**
 * 接頭辞に一致するファイルをまとめて消す。
 *
 * **1 件の失敗で全部を止めない**。消せたものと消せなかったものを両方返すので、
 * 「10 件中 8 件を削除、2 件は失敗」と示せる。
 *
 * @param storage ストレージ
 * @param prefix 接頭辞（例 `tmp/user-42/`）
 * @param options.dryRun 実際には消さず、対象だけ数える
 * @returns 成功・失敗の件数
 *
 * @example
 * ```ts
 * // **まず数えてから消す**（消しすぎを防ぐ）
 * const check = await deleteByPrefix(storage, "tmp/user-42/", { dryRun: true });
 * if (check.ok && check.value.succeeded < 100) {
 *   await deleteByPrefix(storage, "tmp/user-42/");
 * }
 * ```
 */
export async function deleteByPrefix(
  storage: Storage,
  prefix: string,
  options: { dryRun?: boolean } = {},
): Promise<Result<BatchResult>> {
  // **空の接頭辞を弾く。** 全件削除になってしまう
  if (prefix.trim() === "") {
    return err(new AppError(ErrorCode.VALIDATION, "接頭辞が空です。全件削除を防ぐため受け付けません"));
  }

  const listed = await storage.list(prefix);
  if (!listed.ok) return listed;

  const failed: BatchResult["failed"] = [];
  let succeeded = 0;

  for (const key of listed.value) {
    if (options.dryRun === true) {
      succeeded += 1;
      continue;
    }
    const r = await storage.delete(key);
    // **1 件の失敗で止めない。** 残りも消せるだけ消す
    if (r.ok) succeeded += 1;
    else failed.push({ key, message: r.error.message });
  }

  return { ok: true, value: { succeeded, failed } };
}

/**
 * 接頭辞の下をまとめて別の場所へ移す。
 *
 * **フォルダの名前を変える**のに使う。ストレージには本来フォルダが無いので、
 * キーの接頭辞を付け替えることで実現する。
 *
 * @param storage ストレージ
 * @param fromPrefix 移動元の接頭辞
 * @param toPrefix 移動先の接頭辞
 * @returns 成功・失敗の件数
 *
 * @example
 * ```ts
 * // 年度が変わったので移す
 * await movePrefix(storage, "invoices/2025/", "archive/2025/");
 * ```
 */
export async function movePrefix(
  storage: Storage,
  fromPrefix: string,
  toPrefix: string,
): Promise<Result<BatchResult>> {
  if (fromPrefix.trim() === "") {
    return err(new AppError(ErrorCode.VALIDATION, "移動元の接頭辞が空です"));
  }
  if (fromPrefix === toPrefix) {
    return { ok: true, value: { succeeded: 0, failed: [] } };
  }
  // **移動先が移動元の内側だと無限に増える**（invoices/ → invoices/old/）
  if (toPrefix.startsWith(fromPrefix)) {
    return err(new AppError(
      ErrorCode.VALIDATION,
      `移動先が移動元の内側です（${fromPrefix} → ${toPrefix}）。同じファイルを繰り返し移すことになります`,
    ));
  }

  const listed = await storage.list(fromPrefix);
  if (!listed.ok) return listed;

  const failed: BatchResult["failed"] = [];
  let succeeded = 0;

  for (const key of listed.value) {
    const to = `${toPrefix}${key.slice(fromPrefix.length)}`;
    const r = await moveFile(storage, key, to);
    if (r.ok) succeeded += 1;
    else failed.push({ key, message: r.error.message });
  }

  return { ok: true, value: { succeeded, failed } };
}

/** 使用量のまとめ。 */
export interface UsageSummary {
  /** ファイル数。 */
  fileCount: number;
  /** 合計サイズ（バイト）。 */
  totalBytes: number;
  /** 接頭辞ごとの内訳（**多い順**）。 */
  byPrefix: { prefix: string; fileCount: number; totalBytes: number }[];
}

/**
 * 使用量を数える。
 *
 * **誰がどれだけ使っているか**を出すのに使う。
 * 容量が増えてから調べると、どこから手を付けるか分からなくなる。
 *
 * 各ファイルを取得してサイズを見るため、**ファイル数が多いと時間がかかる**。
 * 定期実行して結果を保存する使い方を想定している。
 *
 * @param storage ストレージ
 * @param prefix 対象の接頭辞（省略すると全体）
 * @param options.groupDepth 内訳を取る階層の深さ（既定 1。`users/42/a.pdf` なら `users/`）
 * @returns ファイル数と合計サイズ
 *
 * @example
 * ```ts
 * // 部署ごとの使用量
 * const usage = await calcUsage(storage, "departments/", { groupDepth: 2 });
 * for (const p of usage.value.byPrefix) {
 *   console.log(`${p.prefix}: ${(p.totalBytes / 1024 / 1024).toFixed(1)} MB`);
 * }
 * ```
 */
export async function calcUsage(
  storage: Storage,
  prefix = "",
  options: { groupDepth?: number } = {},
): Promise<Result<UsageSummary>> {
  const depth = Math.max(1, options.groupDepth ?? 1);
  const listed = await storage.list(prefix === "" ? undefined : prefix);
  if (!listed.ok) return listed;

  const groups = new Map<string, { fileCount: number; totalBytes: number }>();
  let fileCount = 0;
  let totalBytes = 0;

  for (const key of listed.value) {
    const body = await storage.get(key);
    // **読めないファイルは数えない**（消えた直後などがありうる）
    if (!body.ok) continue;

    const size = body.value.byteLength;
    fileCount += 1;
    totalBytes += size;

    // 接頭辞を階層で切る
    const parts = key.split("/");
    const groupKey = parts.length > depth ? `${parts.slice(0, depth).join("/")}/` : key;
    const cur = groups.get(groupKey) ?? { fileCount: 0, totalBytes: 0 };
    groups.set(groupKey, { fileCount: cur.fileCount + 1, totalBytes: cur.totalBytes + size });
  }

  return {
    ok: true,
    value: {
      fileCount,
      totalBytes,
      // **多い順**。どこから手を付けるかが分かる
      byPrefix: [...groups]
        .map(([p, v]) => ({ prefix: p, ...v }))
        .sort((a, b) => b.totalBytes - a.totalBytes),
    },
  };
}

/**
 * 古いファイルを探す。
 *
 * キーに日付が含まれている前提で探す（`logs/2025-01-15/...` のような形）。
 * **ストレージは更新日時を持たない実装もある**ため、キーから判断する。
 *
 * @param keys ファイルのキー
 * @param olderThan この日付より古いもの（YYYY-MM-DD）
 * @returns 該当するキー
 *
 * @example
 * ```ts
 * const listed = await storage.list("logs/");
 * if (listed.ok) {
 *   const old = findOlderThan(listed.value, "2025-01-01");
 *   // 確認してから消す
 * }
 * ```
 */
export function findOlderThan(keys: readonly string[], olderThan: string): string[] {
  const datePattern = /(\d{4})[-/]?(\d{2})[-/]?(\d{2})/;
  return keys.filter((key) => {
    const m = datePattern.exec(key);
    if (m === null) return false;
    const [, y, mo, d] = m;
    return `${y}-${mo}-${d}` < olderThan;
  });
}
