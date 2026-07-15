/**
 * eKYC の判定ステータス正規化。ベンダーごとに文言が違うため、共通の {@link EkycStatus} に寄せる。
 * @packageDocumentation
 */

/** 正規化された eKYC ステータス。 */
export type EkycStatus =
  | "created"     // 申込作成済み(未提出)
  | "submitted"   // 書類提出済み(審査待ち)
  | "in_review"   // 審査中
  | "approved"    // 承認(本人確認 OK)
  | "rejected"    // 却下(不備・不一致)
  | "expired"     // 期限切れ
  | "canceled"    // 取消
  | "unknown";    // 不明(マッピング外)

/** ベンダー生ステータス → 正規化ステータスの既定マッピング(TRUSTDOCK 系の語彙を包含)。 */
const DEFAULT_STATUS_MAP: Record<string, EkycStatus> = {
  created: "created", registered: "created", draft: "created",
  submitted: "submitted", uploaded: "submitted", waiting: "submitted", pending: "submitted",
  in_review: "in_review", reviewing: "in_review", checking: "in_review", processing: "in_review",
  approved: "approved", accepted: "approved", ok: "approved", verified: "approved", passed: "approved",
  rejected: "rejected", denied: "rejected", ng: "rejected", failed: "rejected", declined: "rejected",
  expired: "expired", timeout: "expired",
  canceled: "canceled", cancelled: "canceled", withdrawn: "canceled",
};

/**
 * ベンダー生ステータスを正規化する。
 * @param raw ベンダーの status 文字列
 * @param mapping 追加/上書きマッピング(ベンダー独自語彙に対応)
 */
export function normalizeEkycStatus(raw: string | undefined | null, mapping?: Record<string, EkycStatus>): EkycStatus {
  if (!raw) return "unknown";
  const key = raw.trim().toLowerCase();
  return mapping?.[key] ?? DEFAULT_STATUS_MAP[key] ?? "unknown";
}

/** 判定が確定(承認/却下/期限切れ/取消)したか。 */
export function isEkycFinal(status: EkycStatus): boolean {
  return status === "approved" || status === "rejected" || status === "expired" || status === "canceled";
}

/** 本人確認が成立したか。 */
export function isEkycApproved(status: EkycStatus): boolean {
  return status === "approved";
}
