/**
 * **AI が作ったものに印を付ける。**
 *
 * 【なぜ必要か】
 * **AI が作った文書と人が書いた文書が混ざると、
 * 後から見分けられません。**
 * 「この議事録は誰が書いたのか」——**AI かもしれない**と思いながら
 * 読むのと、そうでないのとでは扱いが変わります。
 *
 * 【人が直したら外してください】
 * **人が手を入れたなら、それはもう人の文書**です。
 * 印を残したままだと、**「AI が書いたもの」として軽く扱われます**——
 * 直した人の労力が無駄になります。
 *
 * @param content 中身
 * @param meta 何で作ったか
 * @returns 印を付けた形
 */
export function markAsAiGenerated(
  content: string,
  meta: { model: string; at?: Date },
): { content: string; aiGenerated: true; model: string; generatedAt: string } {
  return {
    content,
    aiGenerated: true,
    model: meta.model,
    generatedAt: (meta.at ?? new Date()).toISOString(),
  };
}

/**
 * **人が直したので、AI の印を外す。**
 *
 * **誰が直したかを残します**——
 * 「AI が作って、山田さんが直した」という経緯が分かるようにするためです。
 *
 * @param doc 印の付いた文書
 * @param editor 直した人
 * @returns 印を外した形
 */
export function markAsHumanEdited(
  doc: { content: string; model?: string; generatedAt?: string },
  editor: string,
): {
  content: string; aiGenerated: false;
  originalModel?: string; editedBy: string; editedAt: string;
} {
  return {
    content: doc.content,
    aiGenerated: false,
    // **元が AI だったことは残します。** 消すと、
    // **「最初から人が書いた」ように見えます**——経緯が失われます。
    originalModel: doc.model,
    editedBy: editor,
    editedAt: new Date().toISOString(),
  };
}

/**
 * **音声を文字にする**（文字起こし）。
 *
 * 【使いどころ】
 * 現場のメモ、電話の記録、会議——**書くより話す方が速い**場面です。
 * `@platform/mobile` の `createAudioRecorder` で録った音をそのまま渡せます。
 *
 * 【必ず知っておくこと】
 * **① 費用は長さで決まります。** 1 時間の会議を毎日文字にすると、
 * **月 20 時間分**。**録る前に「本当に全部要るか」**を考えてください。
 *
 * **② 固有名詞は間違えます。** 社名・人名・専門用語は
 * **平気で違う語になります**——「弊社の田中です」が「兵舎の棚下です」。
 * **人が直す前提**で使ってください。
 *
 * **③ 話し言葉のまま返ります。** 「えー」「あのー」が入り、
 * **そのままでは議事録になりません**——要約を別に通してください。
 *
 * **④ 会議の音声は個人情報です。** 誰が何を言ったかが残ります——
 * **録ることを参加者に伝えて**ください。黙って録ると問題になります。
 *
 * @param config `apiKey`・`fetchImpl`・`baseUrl`
 * @returns 文字起こしをする器
 * @throws 変換に失敗した場合（**音声の形式が合わない**、**長すぎる**など）
 */
export function createTranscriber(config: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}): {
  /**
   * 音声を文字にする。
   *
   * @param audio 音声の中身
   * @param options `filename`（**拡張子で形式を判断されます**）と
   *   `language`（`ja`。**指定しないと言語の判定に時間がかかります**）と
   *   `prompt`（**固有名詞を先に教えると精度が上がります**）
   * @returns 文字にしたもの
   * @throws 変換に失敗した場合
   */
  transcribe(
    audio: Uint8Array,
    options?: { filename?: string; language?: string; prompt?: string },
  ): Promise<{ text: string }>;
} {
  const doFetch = config.fetchImpl ?? fetch;
  const base = config.baseUrl ?? "https://api.openai.com";

  return {
    async transcribe(audio, options = {}) {
      const form = new FormData();
      // **拡張子で形式を判断されます。** `.webm` を `.mp3` と偽ると
      // **中身と食い違って弾かれます**——録音した形式をそのまま付けてください。
      // **`new Uint8Array(...)` で包む(`as BlobPart` は使わない)。**
      // `BlobPart` は DOM 専用の型名で、このパッケージの tsconfig に
      // DOM が無いため参照できない(`check-dom-lib` が検出)。
      // 新しく構築した `Uint8Array` は ArrayBuffer 裏付けとして推論され、
      // `Blob` コンストラクタの要求を満たす——DOM の型名を書かずに
      // 済む、このリポジトリで確立された対処法
      // (2026-08、`check-dom-lib` の指摘を受けて訂正)。
      form.append("file", new Blob([new Uint8Array(audio)]), options.filename ?? "audio.webm");
      form.append("model", "whisper-1");
      // **言語を指定してください。** 指定しないと**判定に時間がかかり**、
      // 短い音声では**英語と誤判定**されることがあります。
      form.append("language", options.language ?? "ja");
      if (options.prompt !== undefined) {
        // **固有名詞を先に教えると精度が上がります。**
        // 「株式会社サンプル、山田、経費精算」のように渡してください。
        form.append("prompt", options.prompt);
      }

      const res = await doFetch(`${base}/v1/audio/transcriptions`, {
        method: "POST",
        headers: { authorization: `Bearer ${config.apiKey}` },
        body: form,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`文字起こしに失敗しました（${res.status}）${detail.slice(0, 200)}`);
      }
      const json = (await res.json()) as { text?: string };
      return { text: json.text ?? "" };
    },
  };
}

/**
 * **ベクトルを小さくする**（量子化）。
 *
 * 【なぜ必要か】
 * 埋め込みは **1 件あたり 1,536 個の小数**です。
 * 4 バイトずつなら **1 件 6KB**——**1 万件で 60MB、10 万件で 600MB**。
 *
 * **メモリに載らなくなると、検索が急に遅くなります**。
 * 小さくすれば載り続けます。
 *
 * 【何を失うか】
 * **精度が少し落ちます。** 小数を 1 バイトに丸めるので、
 * **細かい差が消えます**——**上位 10 件の順番が入れ替わる**程度です。
 *
 * **「だいたい合っていればよい」検索には十分**ですが、
 * **1 位と 2 位を厳密に競わせる**用途には向きません。
 *
 * 【いつ使うか】
 * **数万件を超えてから**で十分です。**1 万件なら 60MB**——
 * まだ困りません。**困る前に複雑にしないでください**。
 *
 * @param vector 元のベクトル
 * @returns 小さくしたものと、戻すのに要る情報
 */
export function quantizeVector(vector: readonly number[]): {
  /** 1 バイトずつに丸めた値。 */
  quantized: Uint8Array;
  /** 戻すのに要る最小値。 */
  min: number;
  /** 戻すのに要る幅。 */
  scale: number;
} {
  if (vector.length === 0) return { quantized: new Uint8Array(0), min: 0, scale: 0 };

  let min = Infinity;
  let max = -Infinity;
  for (const v of vector) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  // **全部同じ値なら幅は 0。** 割り算で NaN を出さないためです
  const scale = range === 0 ? 0 : range / 255;

  const quantized = new Uint8Array(vector.length);
  for (let i = 0; i < vector.length; i += 1) {
    const v = vector[i] ?? 0;
    quantized[i] = scale === 0 ? 0 : Math.round((v - min) / scale);
  }
  return { quantized, min, scale };
}

/**
 * **小さくしたベクトルを戻す。**
 *
 * **元とまったく同じにはなりません。** 丸めた分がずれます——
 * **戻した値で「同じかどうか」を比べないでください**。
 *
 * @param q `quantizeVector` の結果
 * @returns 戻したベクトル
 */
export function dequantizeVector(q: {
  quantized: Uint8Array;
  min: number;
  scale: number;
}): number[] {
  const out: number[] = [];
  for (const b of q.quantized) out.push(q.min + b * q.scale);
  return out;
}
