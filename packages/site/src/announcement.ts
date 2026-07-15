/**
 * お知らせバー(純ロジック)。
 * サイト上部などに出す期間限定の告知。表示期間・対象ページ・閉じた状態を管理する。
 * @packageDocumentation
 */

/** お知らせ。 */
export interface Announcement {
  id: string;
  message: string;
  /** 表示開始(ISO 8601)。 */
  startAt?: string;
  /** 表示終了(ISO 8601)。 */
  endAt?: string;
  /** 対象パス(前方一致。未指定は全ページ)。 */
  paths?: string[];
  /** 行動喚起のラベル・リンク。 */
  ctaLabel?: string;
  ctaHref?: string;
  /** 重要度(表示の優先・色分け用)。 */
  level?: "info" | "warning" | "sale";
}

/** お知らせが今の時点・このパスで表示対象か。 */
export function isAnnouncementActive(a: Announcement, currentPath: string, now: Date = new Date()): boolean {
  const t = now.getTime();
  if (a.startAt && new Date(a.startAt).getTime() > t) return false;
  if (a.endAt && new Date(a.endAt).getTime() <= t) return false;
  if (a.paths && a.paths.length > 0) {
    const path = currentPath.replace(/\/$/, "") || "/";
    const match = a.paths.some((p) => {
      const prefix = p.replace(/\/$/, "") || "/";
      return prefix === "/" ? true : path === prefix || path.startsWith(prefix + "/");
    });
    if (!match) return false;
  }
  return true;
}

/**
 * 表示すべきお知らせを返す(期間・パス・閉じた状態で絞り込み)。
 * @param dismissedIds ユーザーが閉じたお知らせの ID
 */
export function activeAnnouncements(
  announcements: Announcement[],
  currentPath: string,
  options: { now?: Date; dismissedIds?: Iterable<string> } = {},
): Announcement[] {
  const dismissed = new Set(options.dismissedIds ?? []);
  return announcements.filter((a) => !dismissed.has(a.id) && isAnnouncementActive(a, currentPath, options.now));
}

/** 最も優先度の高いお知らせ 1 件を返す(sale > warning > info、その中では先頭)。 */
export function topAnnouncement(announcements: Announcement[], currentPath: string, options?: { now?: Date; dismissedIds?: Iterable<string> }): Announcement | null {
  const active = activeAnnouncements(announcements, currentPath, options);
  const rank: Record<string, number> = { sale: 3, warning: 2, info: 1 };
  return active.sort((a, b) => (rank[b.level ?? "info"] ?? 1) - (rank[a.level ?? "info"] ?? 1))[0] ?? null;
}
