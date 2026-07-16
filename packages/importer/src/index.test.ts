import { describe, it, expect } from "vitest";
import { validateRows, runImport, rowsToObjects, type RowResult } from "./index";
const validate = (raw: Record<string, string>): RowResult<{ name: string }> => raw.name ? { ok: true, value: { name: raw.name } } : { ok: false, errors: ["名前必須"] };
describe("importer", () => {
  it("splits valid and error rows", () => {
    const r = validateRows([{ name: "a" }, { name: "" }], validate);
    expect(r.valid).toHaveLength(1);
    expect(r.errors[0]!.rowIndex).toBe(2);
    expect(r.allValid).toBe(false);
  });
  it("dry-run does not apply", async () => {
    let applied = false;
    const r = await runImport([{ name: "a" }], validate, { dryRun: true, apply: async () => { applied = true; } });
    expect(r.committed).toBe(false); expect(applied).toBe(false);
  });
  it("aborts all on error unless partial", async () => {
    let applied = 0;
    const r1 = await runImport([{ name: "a" }, { name: "" }], validate, { apply: async (v) => { applied = v.length; } });
    expect(r1.committed).toBe(false); expect(applied).toBe(0);
    const r2 = await runImport([{ name: "a" }, { name: "" }], validate, { partial: true, apply: async (v) => { applied = v.length; } });
    expect(r2.applied).toBe(1);
  });
  it("rowsToObjects maps header", () => {
    expect(rowsToObjects(["a", "b"], [["1", "2"]])[0]).toEqual({ a: "1", b: "2" });
  });
});
