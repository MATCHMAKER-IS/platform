import { describe, it, expect } from "vitest";
import { submitExpense, statusLabel, availableActions, actOn, type ExpenseRequest } from "./expense-approval.js";
import type { Actor } from "@platform/workflow";

const exp = { id: "e1", date: "2024-04-30", category: "外注費", amount: 180000 };
const mgr: Actor = { id: "m1", roles: ["manager"] };
const dir: Actor = { id: "d1", roles: ["director"] };
const staff: Actor = { id: "s1", roles: ["staff"] };

describe("expense approval", () => {
  it("starts pending at 課長承認", () => { const r = submitExpense("r1", "taro", exp); expect(statusLabel(r.state)).toBe("課長承認"); });
  it("role gating", () => { const r = submitExpense("r1", "taro", exp); expect(availableActions(r.state, staff)).toEqual([]); expect(availableActions(r.state, mgr)).toEqual(["approve", "reject"]); });
  it("full approval", () => {
    let r: ExpenseRequest = submitExpense("r1", "taro", exp);
    r = actOn(r, mgr, "approve").request;
    expect(availableActions(r.state, dir).sort()).toEqual(["approve", "reject", "sendback"]);
    r = actOn(r, dir, "approve").request;
    expect(statusLabel(r.state)).toBe("承認済み");
  });
  it("sendback returns to 課長承認", () => {
    let r: ExpenseRequest = submitExpense("r1", "taro", exp);
    r = actOn(r, mgr, "approve").request;
    const res = actOn(r, dir, "sendback", "確認");
    expect(res.error).toBeUndefined();
    expect(statusLabel(res.request.state)).toBe("課長承認");
  });
  it("reject terminates", () => { const r = actOn(submitExpense("r1", "taro", exp), mgr, "reject", "NG"); expect(statusLabel(r.request.state)).toBe("却下"); });
  it("unauthorized returns error, state unchanged", () => { const r0 = submitExpense("r1", "taro", exp); const r = actOn(r0, staff, "approve"); expect(r.error).toBeTruthy(); expect(r.request.state.currentStep).toBe(0); });
});
