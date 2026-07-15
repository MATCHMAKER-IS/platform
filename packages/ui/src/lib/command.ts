/**
 * コマンドパレットの検索ロジック(純ロジック・React 非依存)。
 * クエリでコマンドを絞り込み・ランク付けし、グループごとに整理する。
 * @packageDocumentation
 */

/** 実行可能なコマンド(ページ遷移や操作)。 */
export interface Command {
  id: string;
  label: string;
  /** 検索でヒットさせたい別名・キーワード。 */
  keywords?: string[];
  /** グループ名(「ページ」「操作」など)。 */
  group?: string;
  /** 遷移先(操作の場合は onSelect を使う)。 */
  href?: string;
  /** アイコン(コンポーネント側で描画)。 */
  icon?: unknown;
  /** ショートカット表示(例 "⌘K")。 */
  shortcut?: string;
  disabled?: boolean;
}

/**
 * コマンドがクエリに一致するスコアを返す(高いほど上位)。一致しなければ null。
 * ラベル前方一致 > ラベル部分一致 > キーワード一致。
 */
export function scoreCommand(command: Command, query: string): number | null {
  const q = query.trim().toLowerCase();
  if (q === "") return 0;
  const label = command.label.toLowerCase();
  if (label.startsWith(q)) return 3;
  if (label.includes(q)) return 2;
  if (command.keywords?.some((k) => k.toLowerCase().includes(q))) return 1;
  return null;
}

/**
 * クエリでコマンドを絞り込み、スコア順に返す。空クエリは元の順序で全件。
 * 無効コマンドは除外しない(コンポーネント側で見せ方を制御)。
 */
export function filterCommands(commands: Command[], query: string, limit?: number): Command[] {
  const scored = commands
    .map((command, index) => ({ command, index, score: scoreCommand(command, query) }))
    .filter((x): x is { command: Command; index: number; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.command);
  return limit !== undefined ? scored.slice(0, limit) : scored;
}

/** コマンドをグループごとに整理する(グループ未指定は「その他」)。順序は初出順。 */
export function groupCommands(commands: Command[], fallbackGroup = "その他"): { group: string; commands: Command[] }[] {
  const order: string[] = [];
  const map = new Map<string, Command[]>();
  for (const c of commands) {
    const g = c.group ?? fallbackGroup;
    if (!map.has(g)) {
      map.set(g, []);
      order.push(g);
    }
    map.get(g)!.push(c);
  }
  return order.map((group) => ({ group, commands: map.get(group)! }));
}

/** キーボード移動で次の選択インデックスを計算する(循環)。 */
export function nextIndex(current: number, total: number, direction: 1 | -1): number {
  if (total === 0) return -1;
  return (current + direction + total) % total;
}
