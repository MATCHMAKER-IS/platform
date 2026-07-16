import { describe, it, expect } from "vitest";
import { formatFieldValue, reviewItems, describeRecord } from "./review";
const fields = [
  { name: "name", label: "氏名", type: "text" as const },
  { name: "type", label: "種別", type: "radio" as const, options: [{ value: "corp", label: "法人" }, { value: "ind", label: "個人" }] },
  { name: "company", label: "会社名", type: "text" as const, visibleWhen: { field: "type", equals: "corp" } },
  { name: "agree", label: "同意", type: "checkbox" as const },
];
describe("review/detail items", () => {
  it("formats values", () => {
    expect(formatFieldValue(fields[1]!, "corp")).toBe("法人");
    expect(formatFieldValue(fields[3]!, true)).toBe("はい");
    expect(formatFieldValue(fields[0]!, "")).toBe("—");
    expect(formatFieldValue(fields[0]!, ["a", "b"] as never)).toBe("a、b");
  });
  it("builds confirm items (visible only) and detail items (all)", () => {
    const items = reviewItems(fields, { name: "山田", type: "ind", company: "隠", agree: true });
    expect(items.some((i) => i.name === "company")).toBe(false);
    expect(items.find((i) => i.name === "type")!.value).toBe("個人");
    expect(describeRecord(fields, { name: "鈴木", type: "corp" }).map((i) => i.name)).toEqual(["name", "type", "company", "agree"]);
  });
});
