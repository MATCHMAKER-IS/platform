/**
 * **エラーを「次に何をすればよいか」が分かる日本語にする。**
 *
 * 【なぜ要るか】
 * 業務システムを使うのは、**パソコンが得意とは限らない人**です。
 * 経理・総務・現場の人が、**自分の仕事の途中で**この画面を開きます。
 *
 * そこに出る文言が「バリデーションエラー」「不正な要求です」だと、
 * **何が悪いのか・自分で直せるのか・誰に言えばよいのか**が分かりません。
 * 結果として**情シスに電話がかかってきます**——それが本当のコストです。
 *
 * 【3 つの原則】
 *
 * | | |
 * |---|---|
 * | **専門用語を使わない** | 「バリデーション」→「入力の確認」、「タイムアウト」→「時間がかかりすぎた」 |
 * | **次にすることを書く** | 「失敗しました」で終わらせない。**もう一度試すのか、人に頼むのか**を書く |
 * | **利用者を責めない** | 「不正な要求です」は、正しく使っている人にも出ます。**責める言い方をしない** |
 *
 * 【開発者向けの情報は消さない】
 * **ログには詳細をそのまま残します。** ここで言い換えるのは
 * **画面に出す 1 行だけ**です——原因を追う人には、元のメッセージが要ります。
 *
 * @packageDocumentation
 */
import { AppError, ErrorCode } from "@platform/core";

/** 利用者に見せる案内。 */
export interface UserMessage {
  /** 何が起きたか（1 行）。 */
  title: string;
  /**
   * 次に何をすればよいか。
   *
   * **「管理者に連絡してください」だけにしない。** 誰が管理者なのか
   * 分からない人がいます——**まず自分で試せること**を先に書きます。
   */
  action: string;
  /**
   * 利用者の操作で直せるか。
   *
   * **`false` なら、何度試しても同じ**です。画面の「再試行」ボタンは
   * 出さないでください——**押しても直らないボタンは、不信につながります**。
   */
  recoverable: boolean;
}

/**
 * エラーコードごとの案内。
 *
 * **ここが唯一の場所。** 各画面で文言を書くと、
 * **同じ状況なのに画面ごとに違うことを言う**状態になります
 * （「もう一度お試しください」と「管理者に連絡してください」が混在する）。
 */
const MESSAGES: Record<string, UserMessage> = {
  [ErrorCode.VALIDATION]: {
    title: "入力された内容に、直すところがあります",
    // **「赤い印」と書く。** 「バリデーションエラーの箇所」では伝わらない
    action: "赤い印が付いた欄を確かめて、もう一度お試しください。",
    recoverable: true,
  },
  [ErrorCode.NOT_FOUND]: {
    title: "お探しのものが見つかりませんでした",
    // **「消された可能性」を書く。** 「404」では何が起きたか分からない
    action: "すでに削除されたか、URL が変わったのかもしれません。一覧に戻ってお探しください。",
    recoverable: true,
  },
  [ErrorCode.FORBIDDEN]: {
    title: "この操作を行う権限がありません",
    // **「あなたが悪い」と読ませない。** 権限は与えられるもの
    action: "必要であれば、部署の管理者かシステム担当者に権限の追加をご相談ください。",
    recoverable: false,
  },
  [ErrorCode.UNAUTHORIZED]: {
    title: "ログインの有効期間が切れました",
    // **「セッション」と言わない。** 利用者にとっては「ログインし直す」だけ
    action: "お手数ですが、もう一度ログインしてください。入力中の内容は失われることがあります。",
    recoverable: true,
  },
  [ErrorCode.CONFLICT]: {
    title: "ほかの人が先に変更したようです",
    // **具体的に何が起きたかを言う。** 「競合」では想像できない
    action: "画面を読み込み直して、最新の内容を確かめてからもう一度お試しください。",
    recoverable: true,
  },
  [ErrorCode.RATE_LIMITED]: {
    title: "短い時間に多く操作されたため、一時的にお待ちいただいています",
    action: "1 分ほど待ってから、もう一度お試しください。",
    recoverable: true,
  },
  [ErrorCode.EXTERNAL]: {
    title: "連携先のサービスとつながりませんでした",
    // **「相手側の問題かもしれない」と伝える。** 自分の操作を疑い続けさせない
    action: "少し時間をおいてから、もう一度お試しください。続くようならシステム担当者にお知らせください。",
    recoverable: true,
  },
  [ErrorCode.DATABASE]: {
    title: "データの読み書きができませんでした",
    action: "もう一度お試しください。続くようならシステム担当者にお知らせください。",
    recoverable: true,
  },
  [ErrorCode.CONFIG]: {
    title: "システムの設定に不足があります",
    // **利用者には直せない。** 「試してください」と書かない
    action: "この画面ではお直しいただけません。システム担当者にお知らせください。",
    recoverable: false,
  },
};

/** 分類できないときの案内。 */
const FALLBACK: UserMessage = {
  title: "うまく処理できませんでした",
  action: "もう一度お試しください。続くようならシステム担当者にお知らせください。",
  recoverable: true,
};

/**
 * エラーから、**利用者に見せる案内**を作る。
 *
 * **元のメッセージは使いません。** 開発者が書いた文言には
 * 内部の事情（テーブル名・関数名）が混ざることがあり、
 * **見せても分からないうえ、内部構造が漏れます**。
 *
 * @param error 任意のエラー値
 * @returns 画面に出す案内
 *
 * @example
 * ```tsx
 * const msg = toUserMessage(error);
 * <Alert title={msg.title}>
 *   {msg.action}
 *   {msg.recoverable && <Button onClick={retry}>もう一度試す</Button>}
 * </Alert>
 * ```
 */
export function toUserMessage(error: unknown): UserMessage {
  const app = AppError.from(error);
  return MESSAGES[app.code] ?? FALLBACK;
}

/**
 * **画面に出す 1 行**にまとめる（見出しと案内をつなげる）。
 *
 * トーストのように**1 行しか出せない場所**で使います。
 *
 * @param error 任意のエラー値
 * @returns 「〜しました。〜してください。」の形
 */
export function toUserText(error: unknown): string {
  const m = toUserMessage(error);
  return `${m.title}。${m.action}`;
}

/**
 * **操作の名前を添えて**案内を作る。
 *
 * 【なぜ操作名が要るか】
 * 「うまく処理できませんでした」だけだと、**何が終わっていないのか**が
 * 分かりません——保存されたのか、送信されたのか。
 * **同じ画面で複数の操作ができる**とき、特に困ります。
 *
 * @param error 任意のエラー値
 * @param operation 利用者から見た操作の名前（「経費の保存」「メールの送信」）
 * @returns 操作名を含む案内
 *
 * @example
 * ```ts
 * toUserMessageFor(error, "経費の保存");
 * // → { title: "経費の保存ができませんでした", action: "…" }
 * ```
 */
export function toUserMessageFor(error: unknown, operation: string): UserMessage {
  const m = toUserMessage(error);
  const app = AppError.from(error);
  // **入力の誤り・権限は、操作名を足すと不自然になる。**
  // 「経費の保存に、直すところがあります」とは言わない
  if (app.code === ErrorCode.VALIDATION || app.code === ErrorCode.FORBIDDEN) return m;
  return { ...m, title: `${operation}ができませんでした` };
}
