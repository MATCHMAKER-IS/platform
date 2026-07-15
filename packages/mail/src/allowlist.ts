/**
 * 宛先ホワイトリスト(受信者ポリシー)。
 * 許可したアドレス/ドメインだけに送信を絞る。ステージング環境で実顧客に誤送信しない、
 * 社内ドメイン限定で送る、といった安全策に使う。ブロックリストや、全宛先を検証用アドレスへ
 * 付け替える(redirect)にも対応。純ロジック。
 * @packageDocumentation
 */
import type { MailMessage } from "./index.js";
import { normalizeEmail, emailDomain } from "./email.js";

/** 受信者ポリシー。allowed 系を指定するとホワイトリスト方式(未指定なら全許可)。 */
export interface RecipientPolicy {
  /** 許可アドレス(完全一致・大小文字無視)。 */
  allowedEmails?: string[];
  /** 許可ドメイン(例 "example.co.jp")。 */
  allowedDomains?: string[];
  /** 拒否アドレス(allowed より優先)。 */
  blockedEmails?: string[];
  /** 拒否ドメイン(allowed より優先)。 */
  blockedDomains?: string[];
}

function toSet(list: string[] | undefined): Set<string> {
  return new Set((list ?? []).map((s) => s.toLowerCase()));
}

/** アドレスがポリシーで許可されるか。ブロックが最優先、次に allowed(未指定なら許可)。 */
export function isAllowedRecipient(email: string, policy: RecipientPolicy): boolean {
  const addr = normalizeEmail(email).toLowerCase();
  const domain = emailDomain(addr).toLowerCase();

  const blockedEmails = toSet(policy.blockedEmails);
  const blockedDomains = toSet(policy.blockedDomains);
  if (blockedEmails.has(addr) || (domain && blockedDomains.has(domain))) return false;

  const hasAllowlist = (policy.allowedEmails?.length ?? 0) > 0 || (policy.allowedDomains?.length ?? 0) > 0;
  if (!hasAllowlist) return true; // ホワイトリスト未設定 = 全許可(ブロックのみ適用)

  const allowedEmails = toSet(policy.allowedEmails);
  const allowedDomains = toSet(policy.allowedDomains);
  return allowedEmails.has(addr) || (domain !== "" && allowedDomains.has(domain));
}

/** 宛先リストを許可/拒否に振り分ける。 */
export function filterRecipients(emails: string[], policy: RecipientPolicy): { allowed: string[]; blocked: string[] } {
  const allowed: string[] = [];
  const blocked: string[] = [];
  for (const e of emails) (isAllowedRecipient(e, policy) ? allowed : blocked).push(e);
  return { allowed, blocked };
}

/** {@link applyRecipientPolicy} の結果。 */
export interface PolicyApplication {
  /** ポリシー適用後のメッセージ(送信可能なら)。全宛先が弾かれると null。 */
  message: MailMessage | null;
  /** 除外された宛先。 */
  blocked: string[];
  /** redirect により付け替えられたか。 */
  redirected: boolean;
}

/** {@link applyRecipientPolicy} のオプション。 */
export interface ApplyPolicyOptions {
  /** 全宛先をこのアドレスへ付け替える(ステージング用)。指定時はポリシー判定より優先。 */
  redirectTo?: string;
}

/**
 * メッセージの宛先にポリシーを適用する。
 * redirectTo 指定時は全宛先をそのアドレスに付け替える(誤送信防止)。
 * それ以外は許可された宛先だけを残し、全滅なら message=null(送信しない)。
 */
export function applyRecipientPolicy(
  message: MailMessage,
  policy: RecipientPolicy,
  options: ApplyPolicyOptions = {},
): PolicyApplication {
  const originalTo = Array.isArray(message.to) ? message.to : [message.to];

  if (options.redirectTo) {
    return {
      message: { ...message, to: options.redirectTo },
      blocked: [],
      redirected: true,
    };
  }

  const { allowed, blocked } = filterRecipients(originalTo, policy);
  if (allowed.length === 0) {
    return { message: null, blocked, redirected: false };
  }
  return {
    message: { ...message, to: allowed.length === 1 ? allowed[0]! : allowed },
    blocked,
    redirected: false,
  };
}

/**
 * 送信前にポリシーを適用する Mailer ラッパー。弾かれた宛先しか無いメールは送らず、
 * onBlocked で通知だけ受け取れる。ステージングでは redirectTo で検証アドレスに集約できる。
 */
interface Sendable { send(message: MailMessage): Promise<unknown>; }
export function withRecipientPolicy<M extends Sendable>(
  mailer: M,
  policy: RecipientPolicy,
  options: ApplyPolicyOptions & { onBlocked?: (blocked: string[], message: MailMessage) => void } = {},
): M {
  const wrapped: Sendable = {
    async send(message: MailMessage) {
      const applied = applyRecipientPolicy(message, policy, options);
      if (applied.blocked.length > 0) options.onBlocked?.(applied.blocked, message);
      if (!applied.message) {
        // 送信可能な宛先が無い → 送らず、擬似的な成功(スキップ)を返す
        return { ok: true, value: { skipped: true, blocked: applied.blocked } };
      }
      return mailer.send(applied.message);
    },
  };
  return { ...mailer, send: wrapped.send } as M;
}
