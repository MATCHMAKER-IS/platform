/**
 * 代理承認(委任)。承認者の不在時に、権限を委任された人が代理で承認できるようにする。
 * ロールベースの既存エンジンに対し、「実効ロール(自分のロール + 委任されたロール)」を算出する。
 * @packageDocumentation
 */
import type { Actor, WorkflowStep } from "./index";

/** 委任 1 件(from が to に権限を委任)。 */
export interface Delegation {
  /** 委任元(不在になる承認者)の ID。 */
  from: string;
  /** 委任先(代理する人)の ID。 */
  to: string;
  /** 委任するロール(未指定なら from の全ロールを委任)。 */
  roles?: string[];
  /** 有効期間の開始(未指定なら即時)。 */
  since?: Date;
  /** 有効期間の終了(未指定なら無期限)。 */
  until?: Date;
}

/**
 * 指定時刻に有効な委任を返す。
 *
 * **代理承認**(出張・休暇中の承認を他の人に任せる)。期間で有効・無効が変わる。
 *
 * @param delegations 委任の配列
 * @param now 判定する時刻
 * @returns 有効な委任
 */
export function activeDelegations(delegations: Delegation[], now: Date = new Date()): Delegation[] {
  const t = now.getTime();
  return delegations.filter((d) =>
    // **自分自身への委任は無効。** `{ from: "u1", to: "u1", roles: ["director"] }` は
    // **持っていないロールを自分で獲得する**ことになる——委任の登録画面に
    // 「委任元」の入力があれば、自分の名前を入れるだけで昇格できてしまう。
    // 設定ミス(コピペで from と to が同じ)でも起きるので、ここで落とす(2026-08)。
    d.from !== d.to
    && (!d.since || d.since.getTime() <= t) && (!d.until || t < d.until.getTime()),
  );
}

/**
 * actor の実効ロールを返す(自分のロール + actor に委任されたロール)。
 * @param actor 判定する人（本人のロールを含む）
 * @param delegations 委任の配列
 * @param options.now 判定する時刻（**試験で固定する**ため）
 * @param options.roleOf 委任元 ID からその人のロールを引く関数(委任元の全ロールを委任する場合に使用)。
 * @returns 委任を反映したロール(**代理人が本人のロールで承認できる**)
 */
export function effectiveRoles(
  actor: Actor,
  delegations: Delegation[],
  options?: { now?: Date; roleOf?: (userId: string) => string[] },
): string[] {
  const now = options?.now ?? new Date();
  const roles = new Set(actor.roles);
  for (const d of activeDelegations(delegations, now)) {
    if (d.to !== actor.id) continue;
    const delegated = d.roles ?? options?.roleOf?.(d.from) ?? [];
    for (const r of delegated) roles.add(r);
  }
  return [...roles];
}

/**
 * actor が(代理を含めて)そのステップを承認できるか。
 * 代理で承認する場合、その委任元(onBehalfOf)も返す(監査ログ用)。
 * @param step 承認しようとしている段階
 * @param actor 承認しようとする人
 * @param delegations 委任の配列
 * @param options.now 判定する時刻
 * @param options.roleOf 委任元のロールを引く関数
 */
export function resolveApprovalAuthority(
  step: WorkflowStep,
  actor: Actor,
  delegations: Delegation[],
  options?: { now?: Date; roleOf?: (userId: string) => string[] },
): { canApprove: boolean; onBehalfOf?: string } {
  // 自分のロールで承認可能
  if (actor.roles.includes(step.approverRole)) return { canApprove: true };
  // 委任で承認可能か(委任元がそのロールを持つ)
  const now = options?.now ?? new Date();
  for (const d of activeDelegations(delegations, now)) {
    if (d.to !== actor.id) continue;
    const delegatedRoles = d.roles ?? options?.roleOf?.(d.from) ?? [];
    if (delegatedRoles.includes(step.approverRole)) {
      return { canApprove: true, onBehalfOf: d.from };
    }
  }
  return { canApprove: false };
}
