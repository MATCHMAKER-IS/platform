/**
 * 権限の棚卸し(アクセスレビュー)と、退職・異動時の停止。
 *
 * `@platform/auth` は「**今この人が何をできるか**」を判定する。
 * こちらは「**なぜその権限を持っているのか・いつまで持ってよいのか**」を扱う。
 *
 * 権限は付けるときは慎重に検討されるが、**外すきっかけが無い**ため溜まり続ける。
 * 退職者のアカウントが半年後も生きていた、という事故はどの会社でも起きている。
 * 見直す機会を仕組みとして持たせるのが、このパッケージの目的(ADR 0017)。
 * @packageDocumentation
 */

/** 権限を持たせた記録。 */
export interface AccessGrant {
  /** 対象者。 */
  userId: string;
  /** ロール名または権限名。 */
  grant: string;
  /** いつから。 */
  grantedOn: string;
  /** 誰が付けたか(後から理由を聞ける相手)。 */
  grantedBy: string;
  /** なぜ付けたか。**空にしない**(後から要否を判断できなくなる)。 */
  reason: string;
  /** 期限(YYYY-MM-DD)。強い権限には必ず付ける。 */
  expiresOn?: string;
  /** 外した日。 */
  revokedOn?: string;
  /** 最後に棚卸しで確認した日。 */
  lastReviewedOn?: string;
  /** 誰が確認したか。 */
  lastReviewedBy?: string;
}

/** 在籍の状態。 */
export type EmploymentStatus = "active" | "leave" | "resigned";

/** 対象者。 */
export interface Person {
  userId: string;
  name: string;
  /** 所属(異動の検出に使う)。 */
  department: string;
  status: EmploymentStatus;
  /** 退職日(status が resigned のとき)。 */
  resignedOn?: string;
}

/** 棚卸しで見つかった要対応。 */
export interface ReviewFinding {
  userId: string;
  grant: string;
  /** 深刻度。high は**今すぐ**対応する。 */
  severity: "high" | "medium" | "low";
  /** 何が問題か。 */
  reason: string;
  /** どうすればよいか。 */
  action: string;
}

/** 強い権限とみなすもの。ここに載るものは期限付きでのみ許す。 */
export const STRONG_GRANTS = ["*", "admin", "pii:unmask", "system:manage", "period:lock", "user:manage"];

/** 強い権限か。前方一致も見る(`expense:*` のようなワイルドカード)。 */
export function isStrongGrant(grant: string): boolean {
  if (STRONG_GRANTS.includes(grant)) return true;
  return grant.endsWith(":*") || grant === "*";
}

/** 有効な(まだ外されておらず、期限も切れていない)権限か。 */
export function isActiveGrant(g: AccessGrant, asOf: string): boolean {
  if (g.revokedOn && g.revokedOn <= asOf) return false;
  if (g.expiresOn && g.expiresOn <= asOf) return false;
  return g.grantedOn <= asOf;
}

/** 棚卸しの設定。 */
export interface ReviewOptions {
  /** 何日ごとに見直すか(既定 180 = 半年)。 */
  reviewIntervalDays?: number;
  /** 強い権限に許す最長の期間(日。既定 90)。 */
  maxStrongGrantDays?: number;
}

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) =>
  Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

/**
 * 棚卸しを実行し、要対応の一覧を返す。
 *
 * 見つけるもの:
 *   - **退職者に残っている権限**(high。最優先で外す)
 *   - **休職者のログイン可能な権限**(medium)
 *   - **期限切れなのに残っている権限**(high)
 *   - **期限の無い強い権限**(high。恒久的に持たせない)
 *   - **長く見直していない権限**(medium)
 *   - **理由が書かれていない権限**(low。次に判断できない)
 *
 * @param people  対象者
 * @param grants  権限の付与記録
 * @param asOf    基準日(YYYY-MM-DD)
 * @param options 棚卸しの設定
 * @returns 要対応の一覧(深刻度の高い順)
 *
 * @example
 * ```ts
 * const findings = reviewAccess(people, grants, "2026-07-23");
 * const urgent = findings.filter((f) => f.severity === "high");
 * ```
 */
export function reviewAccess(
  people: readonly Person[],
  grants: readonly AccessGrant[],
  asOf: string,
  options: ReviewOptions = {},
): ReviewFinding[] {
  const interval = options.reviewIntervalDays ?? 180;
  const maxStrong = options.maxStrongGrantDays ?? 90;
  const byId = new Map(people.map((p) => [p.userId, p]));
  const findings: ReviewFinding[] = [];

  for (const g of grants) {
    // 既に外したものは対象外
    if (g.revokedOn && g.revokedOn <= asOf) continue;
    const person = byId.get(g.userId);

    // 名簿に無い = 誰の権限か分からない。最も危ない
    if (!person) {
      findings.push({
        userId: g.userId, grant: g.grant, severity: "high",
        reason: "名簿に存在しない利用者の権限です",
        action: "本人を特定できなければ、直ちに外してください",
      });
      continue;
    }

    if (person.status === "resigned") {
      findings.push({
        userId: g.userId, grant: g.grant, severity: "high",
        reason: `退職者(${person.resignedOn ?? "日付不明"})に権限が残っています`,
        action: "セッションを無効化してから権限を外してください",
      });
      continue;
    }

    if (person.status === "leave") {
      findings.push({
        userId: g.userId, grant: g.grant, severity: "medium",
        reason: "休職中の利用者に権限が残っています",
        action: "ログインを止めてください(権限自体は復職に備えて残してよい)",
      });
    }

    if (g.expiresOn && g.expiresOn <= asOf) {
      findings.push({
        userId: g.userId, grant: g.grant, severity: "high",
        reason: `期限(${g.expiresOn})を過ぎています`,
        action: "外すか、必要なら理由を添えて付け直してください",
      });
      continue;
    }

    if (isStrongGrant(g.grant) && !g.expiresOn) {
      findings.push({
        userId: g.userId, grant: g.grant, severity: "high",
        reason: "強い権限に期限が設定されていません",
        action: `期限を付けてください(目安 ${maxStrong} 日以内)`,
      });
    } else if (isStrongGrant(g.grant) && g.expiresOn && daysBetween(g.grantedOn, g.expiresOn) > maxStrong) {
      findings.push({
        userId: g.userId, grant: g.grant, severity: "medium",
        reason: `強い権限の期間が長すぎます(${daysBetween(g.grantedOn, g.expiresOn)} 日)`,
        action: `${maxStrong} 日以内に区切り、必要なら付け直してください`,
      });
    }

    const lastSeen = g.lastReviewedOn ?? g.grantedOn;
    if (daysBetween(lastSeen, asOf) > interval) {
      findings.push({
        userId: g.userId, grant: g.grant, severity: "medium",
        reason: `${daysBetween(lastSeen, asOf)} 日間、見直されていません`,
        action: "所属部署の責任者に要否を確認してください",
      });
    }

    if (g.reason.trim() === "") {
      findings.push({
        userId: g.userId, grant: g.grant, severity: "low",
        reason: "付与の理由が記録されていません",
        action: "理由を補ってください(次の棚卸しで要否を判断できません)",
      });
    }
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.userId.localeCompare(b.userId));
}

/** 退職時にやること 1 件。 */
export interface OffboardingStep {
  order: number;
  title: string;
  detail: string;
  /** 対象の権限(あれば)。 */
  grants?: string[];
}

/**
 * 退職者に対してやることを、**順序つきで**返す。
 *
 * 順序が大事。権限だけ消してもセッションが生きていれば操作できるため、
 * **セッションの無効化が先**。
 *
 * @param person 退職者
 * @param grants その人の権限
 * @returns やることの一覧(順序つき)
 */
export function offboardingSteps(person: Person, grants: readonly AccessGrant[]): OffboardingStep[] {
  const active = grants.filter((g) => g.userId === person.userId && !g.revokedOn).map((g) => g.grant);
  return [
    {
      order: 1,
      title: "セッションを無効化する",
      detail: "権限を消してもセッションが生きていれば操作できます。ここを最初に行います。",
    },
    {
      order: 2,
      title: "ログインを止める",
      detail: "SSO を使っている場合は IdP(Entra ID / Google Workspace)側で止めます。アプリごとに止めると漏れます。",
    },
    {
      order: 3,
      title: "権限を外す",
      detail: "外した記録(誰が・いつ)を残します。監査で必要になります。",
      grants: active,
    },
    {
      order: 4,
      title: "引き継ぎの確認",
      detail: "その人だけが持っていた権限(承認者・管理者)があれば、後任に付け替えます。空席にすると業務が止まります。",
      grants: active.filter((g) => isStrongGrant(g)),
    },
    {
      order: 5,
      title: "記録を残す",
      detail: "いつ・誰が停止したかを監査ログに残します(@platform/audit)。",
    },
  ];
}

/**
 * 棚卸しの結果を、そのまま報告できる形にまとめる。
 *
 * @param findings 要対応の一覧
 * @returns 深刻度ごとの件数と、対応が必要な人数
 */
export function summarizeReview(findings: readonly ReviewFinding[]): {
  high: number; medium: number; low: number; affectedUsers: number;
} {
  return {
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
    affectedUsers: new Set(findings.map((f) => f.userId)).size,
  };
}
