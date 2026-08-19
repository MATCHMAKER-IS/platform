/**
 * **リッチメニュー**（LINE の画面下に固定で出るメニュー）の組み立て。
 *
 * 【なぜ要るか】
 * リッチメニューの定義は**座標を手で書く**必要があり、
 * **1 つずらすと押せない領域ができます**——しかも**画面では気づけません**
 * （見た目は正しく、押しても反応しないだけ）。
 *
 * ここでは**マス目で指定**して、座標は計算に任せます。
 *
 * 【画像との対応に注意】
 * **定義と画像は別物です。** 定義は「どこを押したら何が起きるか」だけで、
 * **見た目は画像が決めます**。**画像のボタンの位置と、ここで指定したマス目が
 * ずれていると、「見えているボタンと違う動きをする」**という
 * 最も分かりにくい不具合になります。
 *
 * **画像を作る人と必ず同じマス目で合わせてください。**
 *
 * @packageDocumentation
 */

/**
 * リッチメニューの大きさ。
 *
 * **LINE が受け付けるのはこの 2 つだけ**です（画像もこの比率で作ります）。
 */
export type RichMenuSize = "large" | "compact";

/** 大きさごとの実寸（px）。 */
const SIZES: Record<RichMenuSize, { width: number; height: number }> = {
  // **大きい方**（2 段のメニューに向く）
  large: { width: 2500, height: 1686 },
  // **小さい方**（1 段。会話の邪魔になりにくい）
  compact: { width: 2500, height: 843 },
};

/** 押したときの動き。 */
export type RichMenuAction =
  /** 文字を送る（利用者の発言として残ります）。 */
  | { kind: "text"; text: string }
  /** データを送る（**発言としては残りません**）。 */
  | { kind: "postback"; data: string; displayText?: string }
  /** URL を開く。 */
  | { kind: "uri"; uri: string };

/**
 * マス目でリッチメニューを組み立てる。
 *
 * 【マス目の考え方】
 * 画面を `columns` × `rows` に等分し、**左上から順に**ボタンを置きます。
 * 3 列 2 行なら 6 つ、2 列 1 行なら 2 つです。
 *
 * ```
 * columns: 3, rows: 2
 * ┌─────┬─────┬─────┐
 * │  0  │  1  │  2  │
 * ├─────┼─────┼─────┤
 * │  3  │  4  │  5  │
 * └─────┴─────┴─────┘
 * ```
 *
 * 【空きマスの扱い】
 * **ボタンが足りなければ、そのマスは押せません**（何も起きません）。
 * 埋めたくないマスには `undefined` を渡してください。
 *
 * 【`chatBarText` について】
 * メニューを開くための**タブに出る文字**です（既定は「メニュー」）。
 * **14 文字まで**で、超えると弾かれます。
 *
 * @param input メニューの構成
 * @returns `createRichMenu` に渡す定義
 * @throws `chatBarText` が 14 文字を超える場合（**LINE に送る前に止めます**
 *   ——送ってから弾かれると、原因が分かりにくいためです）
 */
export function buildRichMenu(input: {
  /** 管理用の名前（利用者には見えません）。 */
  name: string;
  /** 大きさ。 */
  size: RichMenuSize;
  /** 列数（1〜4 が実用的）。 */
  columns: number;
  /** 行数（1〜2 が実用的）。 */
  rows: number;
  /** 左上から順のボタン。**空きマスは `undefined`**。 */
  actions: readonly (RichMenuAction | undefined)[];
  /** タブに出る文字（**14 文字まで**。既定「メニュー」）。 */
  chatBarText?: string;
  /** 開いた状態で始めるか（既定 true）。 */
  selected?: boolean;
}): Record<string, unknown> {
  const { width, height } = SIZES[input.size];
  const cellW = Math.floor(width / input.columns);
  const cellH = Math.floor(height / input.rows);

  const areas: Record<string, unknown>[] = [];
  for (let i = 0; i < input.columns * input.rows; i += 1) {
    const action = input.actions[i];
    // **空きマスは領域を作らない。** 作ると「押せるのに何も起きない」
    // ボタンになり、**壊れていると思われます**。
    if (action === undefined) continue;
    const col = i % input.columns;
    const row = Math.floor(i / input.columns);
    areas.push({
      bounds: {
        x: col * cellW,
        y: row * cellH,
        // **最後の列・行は残り全部を使う。** 割り切れないときに
        // **右端と下端に数 px の隙間**ができ、そこだけ押せなくなります。
        width: col === input.columns - 1 ? width - col * cellW : cellW,
        height: row === input.rows - 1 ? height - row * cellH : cellH,
      },
      action: toLineAction(action),
    });
  }

  const chatBarText = input.chatBarText ?? "メニュー";
  if ([...chatBarText].length > 14) {
    throw new Error(`chatBarText は 14 文字までです（${chatBarText}）`);
  }

  return {
    size: { width, height },
    selected: input.selected ?? true,
    name: input.name,
    chatBarText,
    areas,
  };
}

/** 動きを LINE の形に直す。 */
function toLineAction(action: RichMenuAction): Record<string, unknown> {
  if (action.kind === "text") return { type: "message", text: action.text };
  if (action.kind === "uri") return { type: "uri", uri: action.uri };
  return {
    type: "postback",
    data: action.data,
    // **`displayText` を付けると、押したことが会話に残ります。**
    // 「経費申請を開きました」のように**何をしたかが分かる**ので、
    // あとから見返すときに助かります。
    ...(action.displayText === undefined ? {} : { displayText: action.displayText }),
  };
}
