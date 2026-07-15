import { describe, it, expect } from "vitest";
import { buildTransitionMails } from "./expense-notify.js";
import type { WorkflowState, ApproverDirectory } from "@platform/workflow";

const dir: ApproverDirectory = { manager: [{ email: "manager@x.jp" }], director: [{ email: "director@x.jp" }] };
const s0: WorkflowState = { status: "pending", currentStep: 0, history: [] };
const s1: WorkflowState = { status: "pending", currentStep: 1, history: [{ step: "課長承認", action: "approve", actor: "m1", at: "x" }] };
const approved: WorkflowState = { status: "approved", currentStep: 1, history: [{ step: "部長承認", action: "approve", actor: "d1", at: "y" }] };
const rejected: WorkflowState = { status: "rejected", currentStep: 0, history: [{ step: "課長承認", action: "reject", actor: "m1", at: "z", reason: "要件外" }] };

describe("expense notify", () => {
  it("advance notifies next approver", () => { const m = buildTransitionMails({ title: "経費#1", prev: s0, next: s1, directory: dir }); expect(m).toHaveLength(1); expect(m[0]!.to).toEqual(["director@x.jp"]); });
  it("approved notifies applicant", () => { const m = buildTransitionMails({ title: "経費#1", prev: s1, next: approved, directory: dir, applicantEmail: "taro@x.jp" }); expect(m[0]!.to).toEqual(["taro@x.jp"]); expect(m[0]!.subject).toContain("承認"); });
  it("rejected includes reason", () => { const m = buildTransitionMails({ title: "経費#1", prev: s0, next: rejected, directory: dir, applicantEmail: "taro@x.jp" }); expect(m[0]!.text).toContain("要件外"); });
  it("no applicant email -> skip", () => expect(buildTransitionMails({ title: "x", prev: s1, next: approved, directory: dir })).toHaveLength(0));
  it("no change -> empty", () => expect(buildTransitionMails({ title: "x", prev: s0, next: s0, directory: dir })).toHaveLength(0));
});
