/**
 * デモ用のログインユーザー(ダミー)。
 *
 * この統合デモ(showcase)は DB を持たず、本物のログインもしない
 * (Amplify に単体でデプロイできるようにするため)。
 * それでも「今、誰として画面を見ているか」が分かると、
 * 権限やプロフィールに関わる画面の意味が伝わりやすい。
 * そこで **固定のダミーユーザー**を 1 人だけ用意する。
 *
 * 本物のログイン基盤(@platform/auth)と繋ぐときは、ここを
 * セッションから取得する実装に差し替える。型はそのとき合わせやすいよう
 * 最小限にしてある。
 *
 * @packageDocumentation
 */

/** 画面に出すログインユーザー(デモ用の最小形)。 */
export interface DemoUser {
  /** 表示名。 */
  name: string;
  /** ふりがな(頭文字アバターには使わないが、一覧の並べ替え等で使える)。 */
  kana?: string;
  /** メールアドレス。 */
  email: string;
  /** 部署。 */
  department: string;
  /** 役職。 */
  title: string;
  /** 付与されているロール(権限デモと話を合わせるための表示用)。 */
  roles: string[];
  /** アバターに出す頭文字(無ければ name の先頭から作る)。 */
  initials?: string;
}

/** デモの「ログイン中の人」。実データではなく、固定の見本。 */
export const DEMO_USER: DemoUser = {
  name: "山田 太郎",
  kana: "やまだ たろう",
  email: "taro.yamada@example.co.jp",
  department: "情報システム部",
  title: "主任",
  roles: ["admin", "sales"],
  initials: "山",
};

/** 名前から頭文字を作る(initials 未指定時のフォールバック)。 */
export function initialsOf(user: DemoUser): string {
  if (user.initials) return user.initials;
  // 「山田 太郎」→「山」。空白で切って姓の先頭 1 文字。
  return user.name.trim().charAt(0) || "?";
}
