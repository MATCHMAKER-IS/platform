/**
 * `@platform/notion` — Notion のデータベースとページ。
 *
 * 社内では議事録・手順書・案件管理が Notion に置かれていることが多い。
 * それらを**業務システムから読む/書く**ための最小の層。
 *
 * Notion の API は入れ子が深く(`properties.名前.title[0].plain_text`)、
 * そのまま扱うとアプリ側が読みにくくなる。ここで**平たい形に直して**返す。
 *
 * 対応するのは、実際に使う次の操作だけ:
 *   - データベースの照会(絞り込み・並べ替え)
 *   - ページの作成・更新
 *   - ページ本文の取得
 * 他は `notion.request()` で直接叩ける。
 * @packageDocumentation
 */

const API = "https://api.notion.com/v1";

/** Notion API のバージョン。上げるときは影響を確認すること。 */
export const NOTION_VERSION = "2022-06-28";

/** 平たくしたページ。 */
export interface NotionPage {
  id: string;
  /** タイトル(title 型のプロパティ)。 */
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  /** プロパティを平たくしたもの(型ごとに素直な値へ変換)。 */
  properties: Record<string, string | number | boolean | string[] | null>;
}

/** 作成・更新するプロパティ。 */
export type NotionPropertyInput =
  | { type: "title"; value: string }
  | { type: "rich_text"; value: string }
  | { type: "number"; value: number }
  | { type: "select"; value: string }
  | { type: "multi_select"; value: string[] }
  | { type: "date"; value: string }
  | { type: "checkbox"; value: boolean }
  | { type: "url"; value: string };

/** Notion クライアント。 */
export interface NotionClient {
  /** 任意のパスを叩く(未対応の API 用)。 */
  request<T>(path: string, init?: RequestInit): Promise<T>;
  /** データベースを照会する。 */
  queryDatabase(params: {
    databaseId: string;
    filter?: Record<string, unknown>;
    sorts?: Record<string, unknown>[];
    pageSize?: number;
    /** 続きを取るためのカーソル。 */
    startCursor?: string;
  }): Promise<{ pages: NotionPage[]; nextCursor: string | null }>;
  /** ページを作る。 */
  createPage(params: { databaseId: string; properties: Record<string, NotionPropertyInput>; body?: string }): Promise<NotionPage>;
  /** ページのプロパティを更新する。 */
  updatePage(params: { pageId: string; properties: Record<string, NotionPropertyInput> }): Promise<NotionPage>;
  /** ページ本文を平文で取る(整形は落ちる)。 */
  getPageText(pageId: string): Promise<string>;
  /**
   * データベースを**全件**取る(ページ送りを自動でたどる)。
   * `queryDatabase` は 1 回分(既定 100 件)しか返さないため、
   * 件数が増えたときに**黙って一部だけ処理する**事故が起きる。
   */
  queryAll(params: { databaseId: string; filter?: Record<string, unknown>; sorts?: Record<string, unknown>[]; maxPages?: number }): Promise<NotionPage[]>;
  /** ページの末尾に段落を足す(議事録の追記など)。 */
  appendParagraphs(params: { pageId: string; lines: string[] }): Promise<void>;
  /** 語句でページを探す(共有されているものだけが対象)。 */
  search(params: { query: string; pageSize?: number }): Promise<NotionPage[]>;
}

interface RawProperty {
  type: string;
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  number?: number | null;
  select?: { name: string } | null;
  multi_select?: { name: string }[];
  date?: { start: string } | null;
  checkbox?: boolean;
  url?: string | null;
  people?: { id: string }[];
  status?: { name: string } | null;
}

interface RawPage {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, RawProperty>;
}

/** 入れ子の値を素直な形に直す。 */
function flatten(p: RawProperty): string | number | boolean | string[] | null {
  switch (p.type) {
    case "title": return p.title?.map((t) => t.plain_text).join("") ?? "";
    case "rich_text": return p.rich_text?.map((t) => t.plain_text).join("") ?? "";
    case "number": return p.number ?? null;
    case "select": return p.select?.name ?? null;
    case "status": return p.status?.name ?? null;
    case "multi_select": return p.multi_select?.map((s) => s.name) ?? [];
    case "date": return p.date?.start ?? null;
    case "checkbox": return p.checkbox ?? false;
    case "url": return p.url ?? null;
    case "people": return p.people?.map((x) => x.id) ?? [];
    default: return null;
  }
}

function toPage(raw: RawPage): NotionPage {
  const properties: NotionPage["properties"] = {};
  let title = "";
  for (const [name, prop] of Object.entries(raw.properties)) {
    const v = flatten(prop);
    properties[name] = v;
    if (prop.type === "title" && typeof v === "string") title = v;
  }
  return { id: raw.id, title, url: raw.url, createdAt: raw.created_time, updatedAt: raw.last_edited_time, properties };
}

/** 入力を Notion の形に戻す。 */
function toRawProperty(input: NotionPropertyInput): Record<string, unknown> {
  switch (input.type) {
    case "title": return { title: [{ text: { content: input.value } }] };
    case "rich_text": return { rich_text: [{ text: { content: input.value } }] };
    case "number": return { number: input.value };
    case "select": return { select: { name: input.value } };
    case "multi_select": return { multi_select: input.value.map((name) => ({ name })) };
    case "date": return { date: { start: input.value } };
    case "checkbox": return { checkbox: input.value };
    case "url": return { url: input.value };
  }
}

/**
 * Notion クライアントを作る。
 *
 * **連携したいページ/データベースを、Notion 側でこのインテグレーションに共有しておく**こと。
 * 共有していないと、トークンが正しくても 404 が返る(最も多いつまずき)。
 *
 * @param token     内部インテグレーションのトークン(`ntn_` または `secret_` で始まる)
 * @param fetchImpl テスト用に差し替え可能
 * @returns Notion クライアント
 * @throws Error API が失敗したとき(404 は共有忘れの可能性を示唆する)
 *
 * @example
 * ```ts
 * const notion = createNotionClient(process.env.NOTION_TOKEN);
 * const { pages } = await notion.queryDatabase({ databaseId, pageSize: 20 });
 * ```
 */
export function createNotionClient(token: string, fetchImpl?: typeof fetch): NotionClient {
  const doFetch = fetchImpl ?? fetch;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await doFetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const hint = res.status === 404
        ? "(対象をこのインテグレーションに共有していない可能性があります)"
        : "";
      throw new Error(`Notion ${path} が ${res.status} を返しました${hint}${text ? `: ${text.slice(0, 200)}` : ""}`);
    }
    return (await res.json()) as T;
  }

  return {
    request,

    async queryDatabase({ databaseId, filter, sorts, pageSize, startCursor }) {
      const json = await request<{ results: RawPage[]; next_cursor: string | null }>(
        `/databases/${encodeURIComponent(databaseId)}/query`,
        {
          method: "POST",
          body: JSON.stringify({
            filter, sorts,
            page_size: pageSize ?? 100,
            start_cursor: startCursor,
          }),
        },
      );
      return { pages: json.results.map(toPage), nextCursor: json.next_cursor };
    },

    async createPage({ databaseId, properties, body }) {
      const raw = await request<RawPage>("/pages", {
        method: "POST",
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, toRawProperty(v)])),
          children: body
            ? [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content: body } }] } }]
            : undefined,
        }),
      });
      return toPage(raw);
    },

    async updatePage({ pageId, properties }) {
      const raw = await request<RawPage>(`/pages/${encodeURIComponent(pageId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          properties: Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, toRawProperty(v)])),
        }),
      });
      return toPage(raw);
    },

    async queryAll({ databaseId, filter, sorts, maxPages }) {
      const all: NotionPage[] = [];
      let cursor: string | undefined;
      // 上限を設ける。設定ミスで巨大な DB を全部引くと、相手にも自分にも負荷がかかる
      const limit = maxPages ?? 50;
      for (let i = 0; i < limit; i += 1) {
        const json = await request<{ results: RawPage[]; next_cursor: string | null }>(
          `/databases/${encodeURIComponent(databaseId)}/query`,
          { method: "POST", body: JSON.stringify({ filter, sorts, page_size: 100, start_cursor: cursor }) },
        );
        all.push(...json.results.map(toPage));
        if (!json.next_cursor) return all;
        cursor = json.next_cursor;
      }
      // 上限に達した = 想定より多い。黙って打ち切らず、気づけるようにする
      throw new Error(`Notion のページ送りが ${limit} 回を超えました(${all.length} 件取得済み)。絞り込み条件を見直すか maxPages を上げてください`);
    },

    async appendParagraphs({ pageId, lines }) {
      await request<void>(`/blocks/${encodeURIComponent(pageId)}/children`, {
        method: "PATCH",
        body: JSON.stringify({
          children: lines.map((text) => ({
            object: "block", type: "paragraph",
            paragraph: { rich_text: [{ text: { content: text } }] },
          })),
        }),
      });
    },

    async search({ query, pageSize }) {
      const json = await request<{ results: RawPage[] }>("/search", {
        method: "POST",
        body: JSON.stringify({ query, page_size: pageSize ?? 20, filter: { property: "object", value: "page" } }),
      });
      // 検索結果にはデータベース自身も混ざるので、properties を持つページだけにする
      return json.results.filter((r) => r.properties).map(toPage);
    },

    async getPageText(pageId) {
      const json = await request<{ results: { type: string; [k: string]: unknown }[] }>(
        `/blocks/${encodeURIComponent(pageId)}/children?page_size=100`,
      );
      const lines: string[] = [];
      for (const block of json.results) {
        const content = block[block.type] as { rich_text?: { plain_text: string }[] } | undefined;
        const text = content?.rich_text?.map((t) => t.plain_text).join("") ?? "";
        if (text !== "") lines.push(text);
      }
      return lines.join("\n");
    },
  };
}
