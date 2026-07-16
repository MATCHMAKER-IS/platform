import { describe, it, expect } from "vitest";
import { toImportHistoryRow } from "./import-repo";

describe("import history mapping", () => {
  it("success row", () => { const r = toImportHistoryRow({ id: "b1", source: "CSV", userId: "u1", total: 5, inserted: 5, errorCount: 0, status: "success", createdAt: new Date("2024-05-01T02:00:00Z") }); expect(r.importId).toBe("b1"); expect(r.status).toBe("success"); expect(r.importedAt).toBe("2024-05-01T02:00:00.000Z"); });
  it("partial/rolled_back preserved", () => { expect(toImportHistoryRow({ id: "b2", source: "CSV", userId: "u1", total: 5, inserted: 4, errorCount: 1, status: "partial", createdAt: new Date() }).status).toBe("partial"); expect(toImportHistoryRow({ id: "b3", source: "CSV", userId: "u1", total: 5, inserted: 5, errorCount: 0, status: "rolled_back", createdAt: new Date() }).status).toBe("rolled_back"); });
  it("unknown -> success", () => expect(toImportHistoryRow({ id: "b4", source: "CSV", userId: "u1", total: 1, inserted: 1, errorCount: 0, status: "weird", createdAt: new Date() }).status).toBe("success"));
});
