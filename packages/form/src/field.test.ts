import { describe, it, expect } from "vitest";
import { evaluateRule, isFieldVisible, visibleFields, defaultValues, stripHiddenValues } from "./field";
const fields = [
  { name: "type", label: "種別", type: "radio" as const, options: [{ value: "corp", label: "法人" }, { value: "ind", label: "個人" }] },
  { name: "company", label: "会社名", type: "text" as const, required: true, visibleWhen: { field: "type", equals: "corp" } },
  { name: "reg", label: "登録番号", type: "text" as const, visibleWhen: [{ field: "type", equals: "corp" }, { field: "want", truthy: true }] },
];
describe("dynamic form fields", () => {
  it("evaluates rules and visibility", () => {
    expect(evaluateRule({ field: "x", equals: "a" }, { x: "a" })).toBe(true);
    expect(evaluateRule({ field: "x", in: ["a", "b"] }, { x: "z" })).toBe(false);
    expect(isFieldVisible(fields[1]!, { type: "corp" })).toBe(true);
    expect(isFieldVisible(fields[1]!, { type: "ind" })).toBe(false);
    expect(isFieldVisible(fields[2]!, { type: "corp", want: true })).toBe(true);
    expect(isFieldVisible(fields[2]!, { type: "corp", want: false })).toBe(false);
    expect(visibleFields(fields, { type: "ind" }).map((f) => f.name)).toEqual(["type"]);
  });
  it("derives defaults and strips hidden", () => {
    const dv = defaultValues([{ name: "a", label: "", type: "text" }, { name: "b", label: "", type: "checkbox" }, { name: "c", label: "", type: "select", options: [{ value: "x", label: "X" }] }]);
    expect(dv).toEqual({ a: "", b: false, c: "x" });
    const stripped = stripHiddenValues(fields, { type: "ind", company: "隠", reg: "T1" });
    expect(Object.keys(stripped)).toEqual(["type"]);
  });
});
