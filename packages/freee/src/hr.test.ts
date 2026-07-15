import { describe, it, expect, vi } from "vitest";
import { createFreeeHrClient } from "./hr.js";
function fakeFetch() {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}
describe("freee HR client", () => {
  it("uses HR base url and builds work record paths", async () => {
    const { fetchImpl, calls } = fakeFetch();
    const hr = createFreeeHrClient({ accessToken: "t", fetchImpl });
    await hr.getEmployees(5);
    expect(calls[0]!.url).toContain("/hr/api/v1/companies/5/employees");
    await hr.putWorkRecord(10, { date: "2025-07-25", clockInAt: "2025-07-25T09:00:00" }, 5);
    expect(calls[1]!.method).toBe("PUT");
    expect(calls[1]!.url).toContain("/employees/10/work_records/2025-07-25");
    expect((calls[1]!.body as { clock_in_at: string }).clock_in_at).toBe("2025-07-25T09:00:00");
  });
});
