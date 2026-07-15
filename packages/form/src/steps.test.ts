import { describe, it, expect } from "vitest";
import { stepVisibleFields, stepProgress, nextStep, prevStep, isStepFilled } from "./steps.js";
const fields = [
  { name: "name", label: "氏名", type: "text" as const, required: true },
  { name: "type", label: "種別", type: "radio" as const, options: [{ value: "corp", label: "法人" }] },
  { name: "company", label: "会社名", type: "text" as const, required: true, visibleWhen: { field: "type", equals: "corp" } },
];
const steps = [{ id: "s1", title: "基本", fields: ["name", "type", "company"] }];
describe("multi-step form", () => {
  it("computes step fields and progress", () => {
    expect(stepVisibleFields(steps[0]!, fields, { type: "ind" }).map((f) => f.name)).toEqual(["name", "type"]);
    expect(stepVisibleFields(steps[0]!, fields, { type: "corp" }).map((f) => f.name)).toEqual(["name", "type", "company"]);
    expect(stepProgress(0, 2)).toMatchObject({ isFirst: true, isLast: false, ratio: 0.5 });
    expect(nextStep(1, 2)).toBe(1);
    expect(prevStep(0)).toBe(0);
  });
  it("checks required-filled per visible fields", () => {
    expect(isStepFilled(steps[0]!, fields, { type: "ind", name: "山田" })).toBe(true);
    expect(isStepFilled(steps[0]!, fields, { type: "corp", name: "山田" })).toBe(false);
    expect(isStepFilled(steps[0]!, fields, { type: "corp", name: "山田", company: "A" })).toBe(true);
  });
});
