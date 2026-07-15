/**
 * 記事の版どうしの差分（純ロジック）。行単位の LCS 差分とフィールド差分を返す。
 * @packageDocumentation
 */

/** 差分の 1 行。 */
export interface DiffLine {
  type: "same" | "add" | "del";
  text: string;
}

/** 2 つのテキストを行単位で差分する（LCS ベース）。 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    const row = dp[i]!;
    const next = dp[i + 1]!;
    for (let j = n - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? next[j + 1]! + 1 : Math.max(next[j]!, row[j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i]! });
      i++; j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ type: "del", text: a[i]! });
      i++;
    } else {
      out.push({ type: "add", text: b[j]! });
      j++;
    }
  }
  while (i < m) { out.push({ type: "del", text: a[i]! }); i++; }
  while (j < n) { out.push({ type: "add", text: b[j]! }); j++; }
  return out;
}

/** 差分の対象になる版の最小形（Revision でも CmsPost でも可）。 */
export interface RevisionLike {
  title: string;
  body: string;
  status: string;
  categoryId?: string;
}

/** 版どうしのフィールド差分。 */
export interface RevisionDiff {
  titleChanged: boolean;
  titleFrom: string;
  titleTo: string;
  statusChanged: boolean;
  statusFrom: string;
  statusTo: string;
  categoryChanged: boolean;
  categoryFrom?: string;
  categoryTo?: string;
  body: DiffLine[];
  /** 本文に追加・削除が 1 行でもあるか。 */
  bodyChanged: boolean;
}

/** 2 つの版を比較する（before → after）。 */
export function diffRevisions(before: RevisionLike, after: RevisionLike): RevisionDiff {
  const body = diffLines(before.body, after.body);
  const diff: RevisionDiff = {
    titleChanged: before.title !== after.title,
    titleFrom: before.title,
    titleTo: after.title,
    statusChanged: before.status !== after.status,
    statusFrom: before.status,
    statusTo: after.status,
    categoryChanged: (before.categoryId ?? "") !== (after.categoryId ?? ""),
    body,
    bodyChanged: body.some((l) => l.type !== "same"),
  };
  if (before.categoryId !== undefined) diff.categoryFrom = before.categoryId;
  if (after.categoryId !== undefined) diff.categoryTo = after.categoryId;
  return diff;
}
