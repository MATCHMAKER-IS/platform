/**
 * 通知プレファレンス(ユーザーごとの通知設定)。
 * 「承認依頼は Slack、月次レポートはメール、夜間は通知しない、雑多な通知はダイジェストで」
 * といった設定から、あるイベントを「どのチャネルへ・今すぐか/後でまとめてか」を解決する。
 * 純ロジック(副作用なし)。実際の送信は @platform/notify のチャネルで行う。
 * @packageDocumentation
 */

/** 配信チャネルの種別。 */
export type DeliveryChannel = "email" | "slack" | "line" | "sms" | "push" | "inApp";

/** カテゴリごとの受信方法。immediate=即時, digest=まとめ, off=受け取らない。 */
export type DeliveryMode = "immediate" | "digest" | "off";

/** カテゴリ(イベント種別)ごとの設定。 */
export interface CategoryPreference {
  /** 使用するチャネル。 */
  channels: DeliveryChannel[];
  /** 受信方法(既定 immediate)。 */
  mode?: DeliveryMode;
}

/** 静音時間(この時間帯は緊急以外を配信しない)。時は 0–23。 */
export interface QuietHours {
  /** 開始時(例 22)。 */
  start: number;
  /** 終了時(例 7)。start > end なら日をまたぐ。 */
  end: number;
}

/** ユーザーの通知プレファレンス。 */
export interface NotificationPreference {
  userId?: string;
  /** カテゴリ別設定(キー = カテゴリ名)。 */
  categories?: Record<string, CategoryPreference>;
  /** カテゴリ設定が無いときの既定チャネル。 */
  defaultChannels?: DeliveryChannel[];
  /** 静音時間。 */
  quietHours?: QuietHours;
}

/** 解決対象のイベント。 */
export interface NotifiableEvent {
  /** カテゴリ(approval / report / mention など)。 */
  category: string;
  /** 緊急(静音時間・digest を無視して即時配信)。 */
  urgent?: boolean;
}

/** 配信解決の結果。 */
export interface DeliveryDecision {
  /** 送信先チャネル(即時配信する場合)。deferred/off のときは空。 */
  channels: DeliveryChannel[];
  /** ダイジェストへ回す(今は送らずまとめる)。 */
  deferred: boolean;
  /** 判断理由。 */
  reason: "immediate" | "digest" | "quiet_hours" | "off" | "urgent";
}

/**
 * 静音時間内かを判定する。
 *
 * **日をまたぐ範囲に対応**(22:00–07:00)。深夜に通知を送ると、
 * 利用者は通知そのものを切ってしまう。
 *
 * @param time 判定する時刻
 * @param quietHours 静音時間の設定
 * @returns 静音時間内なら true
 */
export function isQuietHour(quiet: QuietHours | undefined, now: Date): boolean {
  if (!quiet) return false;
  const h = now.getHours();
  if (quiet.start === quiet.end) return false;
  return quiet.start < quiet.end
    ? h >= quiet.start && h < quiet.end          // 例 1–5
    : h >= quiet.start || h < quiet.end;          // 例 22–7(日またぎ)
}

/**
 * イベントの配信方法を解決する。
 * 優先順位: 緊急 → off → digest → 静音時間 → 即時。
 *
 * @param preference 利用者の設定
 * @param notification 通知
 * @param now 現在時刻
 * @returns 配信の判断(**即時 / ダイジェスト / 送らない**)
 */
export function resolveDelivery(pref: NotificationPreference, event: NotifiableEvent, now: Date = new Date()): DeliveryDecision {
  const cat = pref.categories?.[event.category];
  const channels = cat?.channels ?? pref.defaultChannels ?? [];
  const mode: DeliveryMode = cat?.mode ?? "immediate";

  // 緊急は常に即時(off でなければ)
  if (event.urgent && mode !== "off") {
    return { channels, deferred: false, reason: "urgent" };
  }
  if (mode === "off") return { channels: [], deferred: false, reason: "off" };
  if (mode === "digest") return { channels: [], deferred: true, reason: "digest" };
  if (isQuietHour(pref.quietHours, now)) return { channels: [], deferred: true, reason: "quiet_hours" };
  return { channels, deferred: false, reason: "immediate" };
}

/** ダイジェスト項目。 */
export interface DigestItem<E extends NotifiableEvent = NotifiableEvent> {
  event: E;
  decision: DeliveryDecision;
}

/**
 * 複数イベントを一括で解決し、即時配信ぶんと、ダイジェストに回すぶんに分ける。
 * ダイジェスト送信ジョブ・通知処理の入口で使う。
 * @param notifications 通知の配列
 * @param preferences 利用者の設定
 * @param now 現在時刻
 */
export function partitionDeliveries<E extends NotifiableEvent>(
  pref: NotificationPreference,
  events: E[],
  now: Date = new Date(),
): { immediate: DigestItem<E>[]; deferred: DigestItem<E>[]; suppressed: DigestItem<E>[] } {
  const immediate: DigestItem<E>[] = [];
  const deferred: DigestItem<E>[] = [];
  const suppressed: DigestItem<E>[] = [];
  for (const event of events) {
    const decision = resolveDelivery(pref, event, now);
    const item = { event, decision };
    if (decision.reason === "off") suppressed.push(item);
    else if (decision.deferred) deferred.push(item);
    else immediate.push(item);
  }
  return { immediate, deferred, suppressed };
}

/**
 * ダイジェストをカテゴリ別に集計する。
 *
 * **まとめて 1 通にする**(10 件の通知を 10 通送るより、
 * 「新着 10 件」の 1 通の方が読まれる)。
 *
 * @param notifications 通知の配列
 * @returns カテゴリと件数
 */
export function summarizeDigest<E extends NotifiableEvent>(items: DigestItem<E>[]): { category: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.event.category, (counts.get(it.event.category) ?? 0) + 1);
  return [...counts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}
