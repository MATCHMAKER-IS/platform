/**
 * ピン留め(ルーム共有)とブックマーク(個人)の純ロジック。トグル・判定・一覧整列。
 * @packageDocumentation
 */

/** ピン留め(ルーム内で 1 メッセージ 1 件・全員に見える)。 */
export interface Pin {
  roomId: string;
  messageId: string;
  /** 固定した人。 */
  pinnedBy: string;
  pinnedAt: string;
}

/** ブックマーク(ユーザーごとの保存)。 */
export interface Bookmark {
  userId: string;
  messageId: string;
  roomId: string;
  at: string;
}

/**
 * ピン留めを切り替える(既にあれば解除)。
 *
 * **ピンはルーム全体で共有**(全員に見える)。個人用は {@link toggleBookmark}。
 *
 * @param pins 現在のピン
 * @param input ルーム・メッセージ・操作者
 * @param now 現在時刻(テスト注入用)
 * @returns 更新した**新しい**配列と、付けたか外したか
 */
export function togglePin(pins: Pin[], pin: Pin): Pin[] {
  const exists = pins.some((p) => p.roomId === pin.roomId && p.messageId === pin.messageId);
  if (exists) return pins.filter((p) => !(p.roomId === pin.roomId && p.messageId === pin.messageId));
  return [...pins, pin];
}

/**
 * そのメッセージがピン留めされているかを判定する。
 *
 * @param pins ピンの配列
 * @param roomId ルーム
 * @param messageId メッセージ
 * @returns ピン留めされていれば true
 */
export function isPinned(pins: Pin[], roomId: string, messageId: string): boolean {
  return pins.some((p) => p.roomId === roomId && p.messageId === messageId);
}

/**
 * ルームのピン留めを新しい順で返す。
 *
 * @param pins ピンの配列
 * @param roomId ルーム
 * @returns そのルームのピン(新しい順)
 */
export function pinsOf(pins: Pin[], roomId: string): Pin[] {
  return pins.filter((p) => p.roomId === roomId).sort((a, b) => (a.pinnedAt > b.pinnedAt ? -1 : a.pinnedAt < b.pinnedAt ? 1 : 0));
}

/**
 * ブックマークを切り替える(既にあれば解除)。
 *
 * **ブックマークは個人用**(自分にしか見えない)。全員に見せるなら {@link togglePin}。
 *
 * @param bookmarks 現在のブックマーク
 * @param input ユーザー・メッセージ
 * @param now 現在時刻(テスト注入用)
 * @returns 更新した新しい配列と、付けたか外したか
 */
export function toggleBookmark(bookmarks: Bookmark[], bookmark: Bookmark): Bookmark[] {
  const exists = bookmarks.some((b) => b.userId === bookmark.userId && b.messageId === bookmark.messageId);
  if (exists) return bookmarks.filter((b) => !(b.userId === bookmark.userId && b.messageId === bookmark.messageId));
  return [...bookmarks, bookmark];
}

/**
 * そのメッセージをブックマークしているかを判定する。
 *
 * @param bookmarks ブックマークの配列
 * @param userId ユーザー
 * @param messageId メッセージ
 * @returns ブックマークしていれば true
 */
export function isBookmarked(bookmarks: Bookmark[], userId: string, messageId: string): boolean {
  return bookmarks.some((b) => b.userId === userId && b.messageId === messageId);
}

/**
 * ユーザーのブックマークを新しい順で返す。
 *
 * @param bookmarks ブックマークの配列
 * @param userId ユーザー
 * @returns そのユーザーのブックマーク(新しい順)
 */
export function bookmarksOf(bookmarks: Bookmark[], userId: string): Bookmark[] {
  return bookmarks.filter((b) => b.userId === userId).sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : 0));
}
