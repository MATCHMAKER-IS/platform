/**
 * **Google Docs / Forms / Apps Script** を扱う。
 *
 * 【なぜこの 3 つか】
 * 社内には**すでに Google で作られた資産**があります——議事録の雛形、
 * 申請フォーム、スプレッドシートに仕込んだマクロ。
 * **全部を作り直すのは現実的でない**ので、**そのまま使えるようにする**方が早いです。
 *
 * 【共通の注意】
 * **必要な権限（スコープ）が別々**です。1 つの認証で全部は使えません:
 *
 * | サービス | スコープ |
 * |---|---|
 * | Docs | `documents` / `documents.readonly` |
 * | Forms | `forms.body` / `forms.responses.readonly` |
 * | Apps Script | `script.projects` / `script.deployments` |
 *
 * **足りないスコープで呼ぶと 403** になります——
 * 「認証したのに動かない」の多くはこれです。
 *
 * @packageDocumentation
 */
import { createApiClient } from "@platform/integrations";
import type { Result } from "@platform/core";

/** Google Docs を扱う。 */
export interface GoogleDocsClient {
  /**
   * 文書を読む。
   *
   * **中身は「段落の入れ子」**で返ります——見た目そのままの文字列ではありません。
   * 文字だけ欲しいなら {@link extractDocText} を通してください。
   */
  get(documentId: string): Promise<Result<GoogleDoc>>;

  /**
   * **差し込み**（雛形の `{{名前}}` を置き換える）。
   *
   * 【使いどころ】
   * **契約書・案内状・議事録の雛形**を Google Docs で作っておき、
   * 差し込むだけで文書ができます——**書式は Docs 側が持つ**ので、
   * アプリ側で体裁を作り込まなくて済みます。
   *
   * 【注意】
   * **元の文書が書き換わります。** 雛形をそのまま差し込むと**雛形が壊れます**——
   * **Drive で複製してから**差し込んでください（`createGoogleDriveClient` の `copy`）。
   *
   * @param documentId 差し込む文書（**複製した方**）
   * @param replacements `{ "名前": "山田太郎" }` のような対応表
   */
  replaceText(
    documentId: string,
    replacements: Record<string, string>,
  ): Promise<Result<unknown>>;

  /**
   * 末尾に文字を足す。
   *
   * **議事録の追記**に向きます。**書式は付きません**（素の文字）。
   */
  appendText(documentId: string, text: string): Promise<Result<unknown>>;
}

/** Docs の文書（使う部分だけ）。 */
export interface GoogleDoc {
  title?: string;
  body?: {
    content?: {
      paragraph?: { elements?: { textRun?: { content?: string } }[] };
    }[];
  };
}

/**
 * Docs の文書から**文字だけ**を取り出す。
 *
 * **段落の入れ子をたどる**ので、呼び出し側で構造を知らなくて済みます。
 * 表や画像は**飛ばします**——文字が要るときに使うものです。
 *
 * @param doc `get` が返した文書
 * @returns 段落ごとに改行でつないだ文字
 */
export function extractDocText(doc: GoogleDoc): string {
  const parts: string[] = [];
  for (const item of doc.body?.content ?? []) {
    const line = (item.paragraph?.elements ?? [])
      .map((e) => e.textRun?.content ?? "")
      .join("");
    if (line.trim() !== "") parts.push(line.replace(/\n$/, ""));
  }
  return parts.join("\n");
}

/**
 * Google Docs のクライアントを作る。
 *
 * @param config `accessToken`（`documents` のスコープが要ります）
 * @returns Google Docs のクライアント
 */
export function createGoogleDocsClient(config: {
  accessToken: string;
  fetchImpl?: typeof fetch;
}): GoogleDocsClient {
  const api = createApiClient({
    baseUrl: "https://docs.googleapis.com/v1/documents",
    headers: { Authorization: `Bearer ${config.accessToken}` },
    fetchImpl: config.fetchImpl,
  });

  return {
    get: (documentId) => api.get<GoogleDoc>(`/${encodeURIComponent(documentId)}`),

    replaceText: (documentId, replacements) =>
      api.post(`/${encodeURIComponent(documentId)}:batchUpdate`, {
        body: {
          requests: Object.entries(replacements).map(([key, value]) => ({
            replaceAllText: {
              containsText: {
                // **`{{ }}` で囲む決まり**にしてあります。
                // 囲まないと「山田」という語が本文中で**すべて置き換わります**。
                text: `{{${key}}}`,
                matchCase: true,
              },
              replaceText: value,
            },
          })),
        },
      }),

    appendText: (documentId, text) =>
      api.post(`/${encodeURIComponent(documentId)}:batchUpdate`, {
        body: {
          requests: [{
            insertText: {
              // **`endOfSegmentLocation` は末尾**を指します。
              // 位置を数値で指定すると、**文書が変わるたびにずれます**。
              endOfSegmentLocation: {},
              text,
            },
          }],
        },
      }),
  };
}

/** Google Forms を扱う。 */
export interface GoogleFormsClient {
  /** フォームの定義（質問の一覧）を読む。 */
  get(formId: string): Promise<Result<GoogleForm>>;

  /**
   * **回答を読む。**
   *
   * 【使いどころ】
   * **申請フォームを Google Forms で作り、処理はアプリ側**という分担ができます
   * ——フォームの作成は**総務の人が自分でできる**ので、
   * 項目が増えるたびに開発を待たなくて済みます。
   *
   * 【注意】
   * **回答は増え続けます。** 全件取ると、**運用 1 年で数千件**になります。
   * `pageSize` で区切り、**取り込んだところまでを記録**してください。
   */
  listResponses(
    formId: string,
    options?: { pageSize?: number; pageToken?: string },
  ): Promise<Result<{ responses?: GoogleFormResponse[]; nextPageToken?: string }>>;
}

/** フォームの定義（使う部分だけ）。 */
export interface GoogleForm {
  formId?: string;
  info?: { title?: string; description?: string };
  items?: {
    itemId?: string;
    title?: string;
    questionItem?: { question?: { questionId?: string; required?: boolean } };
  }[];
}

/** 1 件の回答。 */
export interface GoogleFormResponse {
  responseId?: string;
  createTime?: string;
  respondentEmail?: string;
  answers?: Record<string, { textAnswers?: { answers?: { value?: string }[] } }>;
}

/**
 * 回答を**「質問名 → 答え」の形**に直す。
 *
 * 【なぜ要るか】
 * Forms の回答は**質問 ID が鍵**になっており、
 * **`a1b2c3` のような文字列**で返ります——そのままでは何の答えか分かりません。
 * フォームの定義と突き合わせて、**人が読める形**にします。
 *
 * **質問名は変えられます。** 名前で対応付けると、
 * **総務の人が質問文を直した瞬間に壊れます**——
 * 取り込みを続けるなら、**質問 ID を控えておく**方が安全です。
 *
 * @param form フォームの定義
 * @param response 1 件の回答
 * @returns `{ "氏名": "山田太郎" }` のような対応表
 */
export function formResponseToRecord(
  form: GoogleForm,
  response: GoogleFormResponse,
): Record<string, string> {
  const titleById = new Map<string, string>();
  for (const item of form.items ?? []) {
    const qid = item.questionItem?.question?.questionId;
    if (qid !== undefined && item.title !== undefined) titleById.set(qid, item.title);
  }
  const out: Record<string, string> = {};
  for (const [qid, answer] of Object.entries(response.answers ?? {})) {
    const title = titleById.get(qid) ?? qid;
    // **複数選択は改行でつなぐ。** カンマだと、
    // **答えにカンマが含まれるとき**に見分けが付きません。
    out[title] = (answer.textAnswers?.answers ?? [])
      .map((a) => a.value ?? "")
      .join("\n");
  }
  return out;
}

/**
 * Google Forms のクライアントを作る。
 *
 * @param config `accessToken`（`forms.body.readonly` と
 *   `forms.responses.readonly` のスコープが要ります）
 * @returns Google Forms のクライアント
 */
export function createGoogleFormsClient(config: {
  accessToken: string;
  fetchImpl?: typeof fetch;
}): GoogleFormsClient {
  const api = createApiClient({
    baseUrl: "https://forms.googleapis.com/v1/forms",
    headers: { Authorization: `Bearer ${config.accessToken}` },
    fetchImpl: config.fetchImpl,
  });

  return {
    get: (formId) => api.get<GoogleForm>(`/${encodeURIComponent(formId)}`),

    listResponses: (formId, options = {}) =>
      api.get(`/${encodeURIComponent(formId)}/responses`, {
        query: {
          // **既定を 100 にしておく。** 指定しないと提供側の既定（少なめ）になり、
          // **取りこぼしたことに気づきにくい**ためです。
          pageSize: String(options.pageSize ?? 100),
          ...(options.pageToken === undefined ? {} : { pageToken: options.pageToken }),
        },
      }),
  };
}

/** Apps Script を扱う。 */
export interface GoogleAppsScriptClient {
  /**
   * **既存のスクリプトを呼ぶ。**
   *
   * 【使いどころ】
   * **社内にすでにあるマクロ**（スプレッドシートの集計、Gmail の一括処理）を
   * **作り直さずに使えます**。「あの人が作った便利なやつ」を
   * アプリから叩けるようにするのが早道です。
   *
   * 【必ず知っておくこと】
   * **① デプロイが要ります。** スクリプトを書いただけでは呼べません
   * ——**「実行可能 API」として配置**し、その ID を使います。
   *
   * **② 実行は同期で、6 分で切れます。** 重い処理を投げると
   * **途中で止まり、何が終わったか分かりません**——
   * **区切って呼ぶ**か、スクリプト側で続きから再開できるようにしてください。
   *
   * **③ エラーは 200 で返ります。** HTTP は成功でも、
   * 本文に `error` が入っていることがあります——
   * **`ok` だけ見て安心しないでください**（この関数は中を見て `err` に直します）。
   *
   * @param scriptId デプロイした ID（スクリプト ID とは別物）
   * @param functionName 呼ぶ関数の名前
   * @param parameters 渡す引数（**JSON にできるものだけ**）
   */
  run(
    scriptId: string,
    functionName: string,
    parameters?: readonly unknown[],
  ): Promise<Result<unknown>>;
}

/** Apps Script の応答（使う部分だけ）。 */
interface AppsScriptRunResponse {
  done?: boolean;
  response?: { result?: unknown };
  error?: {
    details?: { errorMessage?: string; errorType?: string }[];
    message?: string;
  };
}

/**
 * Apps Script のクライアントを作る。
 *
 * @param config `accessToken`（`script.projects` などのスコープが要ります）
 * @returns Apps Script のクライアント
 */
export function createGoogleAppsScriptClient(config: {
  accessToken: string;
  fetchImpl?: typeof fetch;
}): GoogleAppsScriptClient {
  const api = createApiClient({
    baseUrl: "https://script.googleapis.com/v1/scripts",
    headers: { Authorization: `Bearer ${config.accessToken}` },
    fetchImpl: config.fetchImpl,
  });

  return {
    async run(scriptId, functionName, parameters = []) {
      const r = await api.post<AppsScriptRunResponse>(
        `/${encodeURIComponent(scriptId)}:run`,
        { body: { function: functionName, parameters, devMode: false } },
      );
      if (!r.ok) return r;

      // **HTTP は 200 でも、中にエラーが入っていることがあります。**
      // ここで見ておかないと、**失敗を成功として扱って**しまいます。
      const err0 = r.value.error;
      if (err0 !== undefined) {
        const detail = err0.details?.[0];
        const message = detail?.errorMessage ?? err0.message ?? "不明なエラー";
        const type = detail?.errorType ?? "";
        return {
          ok: false,
          error: new Error(
            `Apps Script (${functionName}) が失敗しました: ${type} ${message}`,
          ),
        } as Result<unknown>;
      }
      return { ok: true, value: r.value.response?.result } as Result<unknown>;
    },
  };
}
