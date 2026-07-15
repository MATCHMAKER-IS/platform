import { describe, it, expect } from "vitest";
import { createZohoBookingsClient } from "./index.js";
describe("zoho bookings", () => {
  it("availability + book", async () => {
    let cap: { url: string; body?: { customer_details?: string } } | null = null;
    const fetchImpl = (async (url: string, init: { body?: string }) => { cap = { url, body: init.body ? JSON.parse(init.body) : undefined }; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; }) as unknown as typeof fetch;
    const b = createZohoBookingsClient({ dataCenter: "com", accessToken: "TK", fetchImpl });
    await b.fetchAvailability({ serviceId: "S1", selectedDate: "30-Apr-2026:00:00" });
    expect(cap!.url).toContain("/bookings/v1/json/availableslots");
    expect(cap!.url).toContain("service_id=S1");
    await b.bookAppointment({ service_id: "S1", from_time: "28-Jan-2026 11:00:00", customer_details: { name: "J", email: "j@x.jp" } });
    expect(typeof cap!.body!.customer_details).toBe("string");
  });
});
