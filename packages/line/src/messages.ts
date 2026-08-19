/**
 * LINE メッセージビルダー(純関数)。Flex・テンプレート(ボタン/確認/カルーセル)・
 * クイックリプライを手書き JSON なしで組み立てる。生成物はそのまま push/reply に渡せる。
 * @packageDocumentation
 */
import type { LineMessage } from "./types";

/**
 * テキストメッセージを作る。
 *
 * **5000 文字まで**(超えると API がエラーを返す)。
 *
 * @param text 本文
 * @returns メッセージ
 */
export function textMessage(text: string): LineMessage {
  return { type: "text", text };
}

/**
 * スタンプメッセージを作る。
 *
 * @param packageId スタンプパッケージ
 * @param stickerId スタンプ
 * @returns メッセージ
 */
export function stickerMessage(packageId: string, stickerId: string): LineMessage {
  return { type: "sticker", packageId, stickerId };
}

/**
 * 画像メッセージを作る。
 *
 * **HTTPS 必須**(HTTP の URL は LINE 側で拒否される)。
 * プレビュー画像も要る(一覧に出すため)。
 *
 * @param originalContentUrl 元画像の URL(**HTTPS**)
 * @param previewImageUrl プレビュー画像の URL
 * @returns メッセージ
 */
export function imageMessage(originalContentUrl: string, previewImageUrl?: string): LineMessage {
  return { type: "image", originalContentUrl, previewImageUrl: previewImageUrl ?? originalContentUrl };
}

/**
 * 位置情報メッセージを作る。
 *
 * @param params.title 場所の名前
 * @param params.address 住所
 * @param params.latitude 緯度
 * @param params.longitude 経度
 * @returns メッセージ
 */
export function locationMessage(params: { title: string; address: string; latitude: number; longitude: number }): LineMessage {
  return { type: "location", ...params };
}

// ─────────────────────────── アクション ───────────────────────────

/** ボタン等のアクション。 */
export type LineAction =
  | { type: "message"; label: string; text: string }
  | { type: "postback"; label: string; data: string; displayText?: string }
  | { type: "uri"; label: string; uri: string }
  | { type: "datetimepicker"; label: string; data: string; mode: "date" | "time" | "datetime" };

/**
 * メッセージ送信アクションを作る(ボタンを押すと発言する)。
 *
 * @param label ボタンの表示
 * @param text 送信するテキスト
 * @returns アクション
 */
export function messageAction(label: string, text: string): LineAction {
  return { type: "message", label, text };
}
/**
 * ポストバックアクションを作る。
 *
 * **利用者の発言として残らない**(webhook で `data` を受け取るだけ)。
 * 「はい/いいえ」の選択など、トーク画面に残したくない操作に使う。
 *
 * @param label ボタンの表示
 * @param data webhook で受け取るデータ(**クエリ文字列形式が扱いやすい**)
 * @param displayText トークに表示するテキスト(任意)
 * @returns アクション
 */
export function postbackAction(label: string, data: string, displayText?: string): LineAction {
  return { type: "postback", label, data, ...(displayText ? { displayText } : {}) };
}
/**
 * URI アクション(リンク遷移)。
 *
 *
 * @param label ボタンの表示
 * @param uri 開く URL(**HTTPS 必須**)
 * @returns アクション
 */
export function uriAction(label: string, uri: string): LineAction {
  return { type: "uri", label, uri };
}

// ─────────────────────────── クイックリプライ ───────────────────────────

/**
 * メッセージにクイックリプライ(候補ボタン)を付ける。
 *
 *
 * @param message 元のメッセージ
 * @param actions クイックリプライの項目(**最大 13 件**)
 * @returns クイックリプライ付きのメッセージ(**トーク下部にボタンが並ぶ**。選択肢を示すと会話が進みやすい)
 */
export function withQuickReply(message: LineMessage, actions: LineAction[]): LineMessage {
  return { ...message, quickReply: { items: actions.map((action) => ({ type: "action", action })) } };
}

// ─────────────────────────── テンプレートメッセージ ───────────────────────────

/**
 * ボタンテンプレート(タイトル・本文・ボタン群)。
 *
 *
 * @param params.title 見出し
 * @param params.text 本文
 * @param params.actions 押せる操作（**最大 4 件**）
 * @returns テンプレートメッセージ(**アクションは最大 4 件**)
 */
export function buttonsTemplate(params: { altText: string; title?: string; text: string; actions: LineAction[]; thumbnailImageUrl?: string }): LineMessage {
  return {
    type: "template",
    altText: params.altText,
    template: {
      type: "buttons",
      ...(params.thumbnailImageUrl ? { thumbnailImageUrl: params.thumbnailImageUrl } : {}),
      ...(params.title ? { title: params.title } : {}),
      text: params.text,
      actions: params.actions,
    },
  };
}

/**
 * 確認テンプレート(はい/いいえ の2択)。
 *
 *
 * @param altText 通知に出る代替テキスト（**必須**）
 * @param text 確認する文言
 * @param yes 「はい」側のアクション
 * @param no 「いいえ」側のアクション
 * @returns テンプレートメッセージ
 */
export function confirmTemplate(altText: string, text: string, yes: LineAction, no: LineAction): LineMessage {
  return { type: "template", altText, template: { type: "confirm", text, actions: [yes, no] } };
}

/** カルーセルの1カラム。 */
export interface CarouselColumn {
  title?: string;
  text: string;
  thumbnailImageUrl?: string;
  actions: LineAction[];
}

/**
 * カルーセルテンプレート(横スクロールカード)。
 *
 *
 * @param altText 通知に出る代替テキスト（**必須**。出さないと通知が空になります）
 * @param columns カラム(**最大 10 件**。横スクロールで選ばせる)
 * @returns テンプレートメッセージ
 */
export function carouselTemplate(altText: string, columns: CarouselColumn[]): LineMessage {
  return {
    type: "template",
    altText,
    template: { type: "carousel", columns: columns.map((c) => ({ ...(c.thumbnailImageUrl ? { thumbnailImageUrl: c.thumbnailImageUrl } : {}), ...(c.title ? { title: c.title } : {}), text: c.text, actions: c.actions })) },
  };
}

/**
 * Flex メッセージ(bubble/carousel の contents をそのまま渡す)。
 *
 *
 * @param altText 通知やトーク一覧に出る代替テキスト(**必須**。これが無いと何の通知か分からない)
 * @param contents レイアウト定義
 * @returns Flex メッセージ(**自由なレイアウトを組める**が、定義が複雑)
 */
export function flexMessage(altText: string, contents: Record<string, unknown>): LineMessage {
  return { type: "flex", altText, contents };
}

/**
 * **承認カード**を組み立てる（外出先で承認するためのもの）。
 *
 * 【なぜ LINE で承認するのか】
 * **出先の人は PC を開けません。** 「承認待ちが溜まって業務が止まる」のは、
 * **承認者が席にいないだけ**のことが多く、
 * **スマホで押せれば数秒で終わります**。
 *
 * 【必ず守ること】
 * **押した人が誰かは、`postback` のデータでは決めないでください。**
 * データは**利用者側で作れる**ので、`userId=admin` と偽れます。
 * **LINE の署名で確認した `userId`（`parseLineWebhook` が返すもの）**を使ってください。
 *
 * **金額は必ず出してください。** 「承認しますか」だけだと、
 * **何をいくら承認したか分からないまま押されます**——
 * あとで「聞いていない」と言われます。
 *
 * @param input 申請の内容と、押したときに返すデータ
 * @returns LINE へ送るメッセージ
 */
export function approvalFlexMessage(input: {
  /** 「経費申請」「稟議」など。 */
  title: string;
  /** 申請者の名前。 */
  requester: string;
  /** 金額（円）。**表示は呼び出し側で整えてください**（`formatYen`）。 */
  amountText: string;
  /** 件名や用途。 */
  summary: string;
  /** 承認したときに返すデータ（`approve:123` など）。 */
  approveData: string;
  /** 差し戻すときに返すデータ。 */
  rejectData: string;
}): ReturnType<typeof flexMessage> {
  return flexMessage(
    // **通知に出る文字。** ここに金額を入れておくと、
    // **開かなくても何の件か分かります**
    `${input.title}: ${input.requester} / ${input.amountText}`,
    {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: input.title, weight: "bold", size: "lg" },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            spacing: "sm",
            contents: [
              row("申請者", input.requester),
              row("金額", input.amountText),
              row("内容", input.summary),
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "secondary",
            action: { type: "postback", label: "差し戻す", data: input.rejectData },
          },
          {
            type: "button",
            style: "primary",
            action: { type: "postback", label: "承認する", data: input.approveData },
          },
        ],
      },
    },
  );
}

/** 承認カードの 1 行（見出しと値）。 */
function row(label: string, value: string): Record<string, unknown> {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      { type: "text", text: label, color: "#888888", size: "sm", flex: 2 },
      // **`wrap: true` を必ず付ける。** 付けないと長い用途が
      // **途中で切れて読めなくなります**（スマホは横幅が狭い）
      { type: "text", text: value, wrap: true, size: "sm", flex: 5 },
    ],
  };
}

/**
 * 動画メッセージを作る。
 *
 * **サムネイル（`previewImageUrl`）は必須**です——
 * 省略すると**再生前が真っ黒**になり、何の動画か分かりません。
 *
 * **どちらも HTTPS でなければ届きません。** HTTP のままだと
 * **エラーにならず、ただ表示されない**——一番気づきにくい形で失敗します。
 *
 * **上限は 200MB / 1 分**です。現場で撮った動画はすぐ超えるので、
 * **送る前に長さを確かめて**ください。
 *
 * @param originalContentUrl 動画の URL（**HTTPS のみ**）
 * @param previewImageUrl サムネイルの URL（**HTTPS のみ**）
 * @returns 動画メッセージ
 */
export function videoMessage(
  originalContentUrl: string,
  previewImageUrl: string,
): LineMessage {
  return { type: "video", originalContentUrl, previewImageUrl };
}

/**
 * 音声メッセージを作る。
 *
 * **長さ（ミリ秒）を渡してください。** 渡さないと
 * **再生バーが出ず、何秒あるか分からないまま聞かせる**ことになります。
 *
 * **形式は m4a のみ**です。ブラウザの録音は webm で返ることが多いので、
 * **変換が要ります**（`@platform/media`）。
 *
 * @param originalContentUrl 音声の URL（**HTTPS のみ**）
 * @param durationMs 長さ（ミリ秒）
 * @returns 音声メッセージ
 */
export function audioMessage(
  originalContentUrl: string,
  durationMs: number,
): LineMessage {
  return { type: "audio", originalContentUrl, duration: durationMs };
}

/**
 * **日時を選ばせる**操作を作る。
 *
 * 【使いどころ】
 * 「いつ来られますか」「希望日は」を**文字で書かせない**ためのものです。
 * 文字だと「来週の火曜」「3/5」「3月5日」がばらばらに届き、
 * **受け取る側で解釈が要ります**——選ばせれば形が揃います。
 *
 * 【必ず範囲を決めてください】
 * `min` / `max` を渡さないと、**過去の日付や 10 年後**も選べます。
 * 予約なら「明日から 3 か月先まで」のように**必ず絞って**ください。
 *
 * 【形式に注意】
 * **`yyyy-MM-ddTHH:mm`**（`date` なら `yyyy-MM-dd`）です。
 * **秒やタイムゾーンを付けると弾かれます**。
 *
 * @param label ボタンの文字（**20 文字まで**）
 * @param data 選んだあとに返るデータ
 * @param options `mode`（既定 `datetime`）と `initial` / `min` / `max`
 * @returns 日時選択の操作
 */
export function datetimePickerAction(
  label: string,
  data: string,
  options: {
    mode?: "date" | "time" | "datetime";
    initial?: string;
    min?: string;
    max?: string;
  } = {},
): Record<string, unknown> {
  return {
    type: "datetimepicker",
    label,
    data,
    mode: options.mode ?? "datetime",
    ...(options.initial === undefined ? {} : { initial: options.initial }),
    ...(options.min === undefined ? {} : { min: options.min }),
    ...(options.max === undefined ? {} : { max: options.max }),
  };
}

/**
 * **カメラを開く**操作を作る（クイックリプライ専用）。
 *
 * 【使いどころ】
 * 「領収書を撮って送ってください」を**その場で撮らせます**——
 * アルバムを開かせると、**関係ない写真を選ぶ事故**が起きます。
 *
 * **クイックリプライの中でしか使えません。** 普通のボタンに入れても
 * **無視されます**（エラーにもなりません）。
 *
 * @param label ボタンの文字
 * @returns カメラを開く操作
 */
export function cameraAction(label: string): Record<string, unknown> {
  return { type: "camera", label };
}

/**
 * **アルバムを開く**操作を作る（クイックリプライ専用）。
 *
 * すでに撮ってある写真を送らせるときに使います。
 * **その場で撮ってほしいなら {@link cameraAction}** を使ってください。
 *
 * @param label ボタンの文字
 * @returns アルバムを開く操作
 */
export function cameraRollAction(label: string): Record<string, unknown> {
  return { type: "cameraRoll", label };
}

/**
 * **位置情報を送らせる**操作を作る（クイックリプライ専用）。
 *
 * 「今どこにいますか」を**住所で書かせない**ためのものです。
 * 現場の報告や、直行直帰の記録に使えます。
 *
 * **位置情報は個人情報です。** 何に使うかを先に伝え、
 * **必要な場面だけ**求めてください——常に求めると不信感を持たれます。
 *
 * @param label ボタンの文字
 * @returns 位置情報を送る操作
 */
export function locationAction(label: string): Record<string, unknown> {
  return { type: "location", label };
}
