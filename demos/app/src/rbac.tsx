"use client";
/**
 * RBAC ゲート。ポリシーと現在ロールから権限を判定し、UI を出し分ける。
 * ロジックは @platform/auth の can()。ここは React への薄い橋渡し。
 * @packageDocumentation
 */
import * as React from "react";
import { definePolicy, can, type Policy, type Role } from "@platform/auth";

/** アプリの権限ポリシー。 */
export const policy: Policy = definePolicy({
  admin: ["*"],
  manager: ["booking:read", "booking:write", "cast:read", "report:read"],
  staff: ["booking:read", "cast:read"],
});

/** ロール → 権限判定のコンテキスト。 */
const RoleContext = React.createContext<Role[]>(["staff"]);

/** 現在ロールを供給する。 */
export function RoleProvider({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  return <RoleContext.Provider value={roles}>{children}</RoleContext.Provider>;
}

/** 現在ロールで権限があるか判定する述語を返す。 */
export function useCan(): (permission: string) => boolean {
  const roles = React.useContext(RoleContext);
  return React.useCallback((permission: string) => can(policy, roles, permission), [roles]);
}

/** 権限があるときだけ子を表示するゲート。 */
export function Can({ permission, children, fallback = null }: { permission: string; children: React.ReactNode; fallback?: React.ReactNode }) {
  const allowed = useCan()(permission);
  return <>{allowed ? children : fallback}</>;
}
