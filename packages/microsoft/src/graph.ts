/**
 * Microsoft Graph の最小クライアント(メール送信・予定・利用者)。
 *
 * Graph は 1 つの入口(`https://graph.microsoft.com/v1.0`)で、
 * Outlook・Teams・OneDrive・Entra の利用者情報まで扱える。
 * ここでは**社内システムで実際に使う 3 つ**だけを型付きで包む。
 *
 * 全部を包まないのは、包んだ分だけ相手の変更に追随する義務が増えるため。
 * 必要になったら `graph.request()` で直接叩き、定着してから関数にする。
 * @packageDocumentation
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

/** Graph クライアント。 */
export interface MicrosoftGraphClient {
  /** 任意のパスを叩く(未対応の API 用)。 */
  request<T>(path: string, init?: RequestInit): Promise<T>;
  /** メールを送る。 */
  sendMail(input: GraphMailInput): Promise<void>;
  /** 予定を作る。 */
  createEvent(input: GraphEventInput): Promise<GraphEvent>;
  /** 期間内の予定を取る。 */
  listEvents(params: { start: string; end: string; userId?: string }): Promise<GraphEvent[]>;
  /** 自分の情報を取る(疎通確認にも使う)。 */
  me(): Promise<GraphUser>;
  /**
   * **Teams のチャネルに投稿する。**
   *
   * Slack を使わない会社では、**承認依頼や障害の知らせを流す先**になります。
   *
   * **`html` を使うと書式が付きます**（太字・リンク）が、
   * **使える書式は限られます**——`<b>` `<a>` `<br>` 程度で、
   * **凝った HTML は無視されるか、そのまま文字として出ます**。
   *
   * **チャネル ID は「一般」でも固定ではありません。**
   * チームごとに違うので、**管理画面で確認して設定に入れて**ください。
   *
   * @param input `teamId` / `channelId` / `text`（素の文字）/ `html`（書式付き）
   * @returns 投稿した結果
   */
  postTeamsChannelMessage(input: {
    teamId: string;
    channelId: string;
    text: string;
    html?: string;
  }): Promise<unknown>;

  /**
   * **在籍している人の一覧**（Entra ID / 旧 Azure AD）。
   *
   * 【何に使うか】
   * **退職者のアカウントが社内システムに残る**問題を機械で防げます。
   * 定期的に引いて、**ここに居ない人はアプリ側でも止める**という使い方です。
   *
   * **無効にされた人は返りません**（`accountEnabled eq true` で絞っています）
   * ——絞らないと**退職者も含めて返り**、そのまま同期すると
   * **止めたはずのアカウントが復活します**。
   *
   * 【件数に注意】
   * **既定は 100 件**です。**従業員が 100 人を超える会社では 1 回で取り切れません**
   * ——返ってきた `@odata.nextLink` を必ずたどってください。
   *
   * @param options `top`（1 回に取る件数。最大 999）
   * @returns 在籍者の一覧と、続きがあれば `@odata.nextLink`
   */
  listActiveUsers(options?: { top?: number }): Promise<unknown>;

  /**
   * メールアドレスから 1 人を引く。
   *
   * **`userPrincipalName` はメールと違うことがあります**——
   * 改姓や転属で `mail` だけ変わり、`userPrincipalName` が古いままの
   * 会社が実際にあります。**両方で探します**。
   *
   * **在籍していない人も返ります**（`accountEnabled` を見てください）
   * ——「見つかった＝今も社員」ではありません。
   *
   * @param email 探すメールアドレス
   * @returns 一致した人（**0 件のこともあります**）
   */
  getUserByEmail(email: string): Promise<unknown>;

  /**
   * 複数人の予定の埋まり具合を調べる(会議の調整)。
   * 予定の中身は返らず、**空きか埋まりか**だけが分かる。
   */
  getSchedule(params: { emails: string[]; start: string; end: string; intervalMinutes?: number }): Promise<ScheduleAvailability[]>;
  /**
   * OneDrive / SharePoint にファイルを置く(帳票の保存先など)。
   * 4MB を超える場合は分割アップロードが必要なため、ここでは受け付けない。
   */
  uploadFile(params: { path: string; content: ArrayBuffer | Uint8Array | string; contentType?: string; userId?: string }): Promise<GraphFile>;
  /** 組織の利用者を引く(社員名簿の同期など)。 */
  listUsers(params?: { filter?: string; top?: number }): Promise<GraphUser[]>;
}

/** 予定の埋まり具合。 */
export interface ScheduleAvailability {
  email: string;
  /** 埋まっている時間帯。 */
  busy: { start: string; end: string; status: string }[];
  /** 参照できたか(権限が無い相手は false)。 */
  available: boolean;
}

/** 保存したファイル。 */
export interface GraphFile {
  id: string;
  name: string;
  size: number;
  /** ブラウザで開けるリンク。 */
  webUrl: string;
}

/** 送信するメール。 */
export interface GraphMailInput {
  to: string[];
  subject: string;
  body: string;
  /** 既定は text。HTML で送るなら "html"。 */
  contentType?: "text" | "html";
  cc?: string[];
  /**
   * 表に出さない宛先(一斉配信用)。
   *
   * **`to` に全員を入れない。** 入れると**受信者全員に全員のアドレスが見える**
   * ——社外へ送れば**そのまま個人情報の漏洩事故**になる。
   * `@platform/mail` と同じ問題が Graph 経由でも起きるので揃えた(2026-08)。
   */
  bcc?: string[];
  /** 送信箱に残すか(既定 true)。 */
  saveToSentItems?: boolean;
  /** 差出人(共有メールボックスから送る場合。省略時はトークンの持ち主)。 */
  fromUserId?: string;
}

/** 予定。 */
export interface GraphEvent {
  id: string;
  subject: string;
  /** ISO 8601。 */
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
  onlineMeetingUrl?: string;
}

/** 作成する予定。 */
export interface GraphEventInput {
  subject: string;
  start: string;
  end: string;
  /** 予定を入れる相手(省略時はトークンの持ち主)。 */
  userId?: string;
  location?: string;
  attendees?: string[];
  body?: string;
  /** Teams 会議のリンクを付けるか。 */
  onlineMeeting?: boolean;
  /** タイムゾーン(既定 "Asia/Tokyo")。 */
  timeZone?: string;
}

/** 利用者。 */
export interface GraphUser {
  id: string;
  displayName: string;
  mail?: string;
  userPrincipalName: string;
  jobTitle?: string;
  department?: string;
}

interface GraphEventRaw {
  id: string;
  subject: string;
  start: { dateTime: string };
  end: { dateTime: string };
  location?: { displayName?: string };
  attendees?: { emailAddress?: { address?: string } }[];
  onlineMeeting?: { joinUrl?: string };
}

function toEvent(raw: GraphEventRaw): GraphEvent {
  return {
    id: raw.id,
    subject: raw.subject,
    start: raw.start.dateTime,
    end: raw.end.dateTime,
    location: raw.location?.displayName,
    attendees: raw.attendees?.map((a) => a.emailAddress?.address ?? "").filter((x) => x !== ""),
    onlineMeetingUrl: raw.onlineMeeting?.joinUrl,
  };
}

/**
 * Graph クライアントを作る。
 *
 * @param authedFetch `createMicrosoftAuthedFetch` で作った認証済み fetch
 * @returns Graph クライアント
 * @throws Error Graph が失敗を返したとき(状態コードと本文の先頭を含める)
 *
 * @example
 * ```ts
 * const graph = createMicrosoftGraphClient(authedFetch);
 * await graph.sendMail({ to: ["taro@example.co.jp"], subject: "月次締め", body: "本日締めです" });
 * ```
 */
export function createMicrosoftGraphClient(authedFetch: typeof fetch): MicrosoftGraphClient {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await authedFetch(`${GRAPH}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      // Graph はエラー本文に理由が入る。原因調査ができるよう本文まで含める
      const text = await res.text().catch(() => "");
      throw new Error(`Microsoft Graph ${path} が ${res.status} を返しました${text ? `: ${text.slice(0, 200)}` : ""}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    request,

    async sendMail(input) {
      const base = input.fromUserId ? `/users/${encodeURIComponent(input.fromUserId)}` : "/me";
      await request<void>(`${base}/sendMail`, {
        method: "POST",
        body: JSON.stringify({
          message: {
            subject: input.subject,
            body: { contentType: input.contentType ?? "text", content: input.body },
            toRecipients: input.to.map((a) => ({ emailAddress: { address: a } })),
            ccRecipients: (input.cc ?? []).map((a) => ({ emailAddress: { address: a } })),
            // **bcc を落とさない。** 型に足しても渡さなければ一斉配信が届かない
            bccRecipients: (input.bcc ?? []).map((a) => ({ emailAddress: { address: a } })),
          },
          saveToSentItems: input.saveToSentItems ?? true,
        }),
      });
    },

    async createEvent(input) {
      const base = input.userId ? `/users/${encodeURIComponent(input.userId)}` : "/me";
      const tz = input.timeZone ?? "Asia/Tokyo";
      const raw = await request<GraphEventRaw>(`${base}/events`, {
        method: "POST",
        body: JSON.stringify({
          subject: input.subject,
          start: { dateTime: input.start, timeZone: tz },
          end: { dateTime: input.end, timeZone: tz },
          location: input.location ? { displayName: input.location } : undefined,
          attendees: (input.attendees ?? []).map((a) => ({ emailAddress: { address: a }, type: "required" })),
          body: input.body ? { contentType: "text", content: input.body } : undefined,
          isOnlineMeeting: input.onlineMeeting ?? false,
          onlineMeetingProvider: input.onlineMeeting ? "teamsForBusiness" : undefined,
        }),
      });
      return toEvent(raw);
    },

    async listEvents({ start, end, userId }) {
      const base = userId ? `/users/${encodeURIComponent(userId)}` : "/me";
      const q = new URLSearchParams({ startDateTime: start, endDateTime: end, $orderby: "start/dateTime" });
      const json = await request<{ value: GraphEventRaw[] }>(`${base}/calendarView?${q.toString()}`);
      return json.value.map(toEvent);
    },

    async me() {
      return request<GraphUser>("/me?$select=id,displayName,mail,userPrincipalName,jobTitle,department");
    },

    async postTeamsChannelMessage({ teamId, channelId, text, html }) {
      // **Teams への投稿。** Slack を使わない会社では、
      // **承認依頼や障害の知らせを流す先**になります。
      //
      // **`html` を使うと書式が付きます**（太字・リンク）が、
      // **使える書式は限られます**——`<b>` `<a>` `<br>` 程度で、
      // **凝った HTML は無視されるか、そのまま文字として出ます**。
      //
      // **チャネル ID は「一般」でも固定ではありません。**
      // チームごとに違うので、**管理画面で確認して設定に入れて**ください。
      return request(
        `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            body: html === undefined
              ? { contentType: "text", content: text }
              : { contentType: "html", content: html },
          }),
        },
      );
    },

    async listActiveUsers({ top } = {}) {
      // **在籍している人の一覧。**
      //
      // 【何に使うか】
      // **退職者のアカウントが社内システムに残る**問題を機械で防げます。
      // Entra ID（旧 Azure AD）で無効にされた人を定期的に引き、
      // **アプリ側の利用者も止める**という使い方です。
      //
      // **`accountEnabled eq true` で絞っています**——
      // 絞らないと**退職者も含めて返り**、そのまま同期すると
      // **止めたはずのアカウントが復活します**。
      //
      // 【件数に注意】
      // **既定は 100 件**で、それ以上は `@odata.nextLink` をたどります。
      // **従業員が 100 人を超える会社では 1 回で取り切れません**。
      const params = new URLSearchParams({
        $filter: "accountEnabled eq true",
        $select: "id,displayName,mail,userPrincipalName,accountEnabled,department,jobTitle",
        $top: String(Math.min(top ?? 100, 999)),
      });
      return request(`/users?${params.toString()}`, { method: "GET" });
    },

    async getUserByEmail(email) {
      // **メールアドレスから 1 人を引く。**
      //
      // **`userPrincipalName` はメールと違うことがあります**——
      // 改姓や転属で `mail` だけ変わり、`userPrincipalName` が古いままの
      // 会社が実際にあります。**両方で探します**。
      const esc = email.replace(/'/g, "''");
      const params = new URLSearchParams({
        $filter: `mail eq '${esc}' or userPrincipalName eq '${esc}'`,
        $select: "id,displayName,mail,userPrincipalName,accountEnabled,department,jobTitle",
      });
      return request(`/users?${params.toString()}`, { method: "GET" });
    },

    async getSchedule({ emails, start, end, intervalMinutes }) {
      const json = await request<{ value: { scheduleId: string; scheduleItems?: { start: { dateTime: string }; end: { dateTime: string }; status: string }[]; error?: unknown }[] }>(
        "/me/calendar/getSchedule",
        {
          method: "POST",
          body: JSON.stringify({
            schedules: emails,
            startTime: { dateTime: start, timeZone: "Asia/Tokyo" },
            endTime: { dateTime: end, timeZone: "Asia/Tokyo" },
            availabilityViewInterval: intervalMinutes ?? 30,
          }),
        },
      );
      return json.value.map((v) => ({
        email: v.scheduleId,
        // 権限が無いと予定が空で返る。空きと区別できるよう available で示す
        available: v.error === undefined,
        busy: (v.scheduleItems ?? []).map((i) => ({ start: i.start.dateTime, end: i.end.dateTime, status: i.status })),
      }));
    },

    async uploadFile({ path, content, contentType, userId }) {
      const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
      const size = bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.length;
      // 4MB を超えると単純な PUT では上げられない(分割アップロードが必要)
      if (size > 4 * 1024 * 1024) {
        throw new Error("4MB を超えるファイルは分割アップロードが必要です(この関数では扱いません)");
      }
      const base = userId ? `/users/${encodeURIComponent(userId)}` : "/me";
      return request<GraphFile>(`${base}/drive/root:/${path.replace(/^\/+/, "")}:/content`, {
        method: "PUT",
        headers: { "Content-Type": contentType ?? "application/octet-stream" },
        body: bytes as BodyInit,
      });
    },

    async listUsers(params = {}) {
      const q = new URLSearchParams({ $select: "id,displayName,mail,userPrincipalName,jobTitle,department" });
      if (params.filter) q.set("$filter", params.filter);
      q.set("$top", String(Math.min(params.top ?? 100, 999)));
      const json = await request<{ value: GraphUser[] }>(`/users?${q.toString()}`);
      return json.value;
    },
  };
}
