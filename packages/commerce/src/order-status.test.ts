import { describe, it, expect } from "vitest";
import { canTransition, nextStatuses, isFinalStatus, isCancellable, isShipped, ORDER_STATUS_LABELS } from "./order-status.js";
describe("order status", () => {
  it("validates transitions", () => {
    expect(canTransition("pending", "paid")).toBe(true);
    expect(canTransition("pending", "shipped")).toBe(false);
    expect(nextStatuses("paid").sort()).toEqual(["cancelled", "processing", "refunded"]);
    expect(isFinalStatus("cancelled")).toBe(true);
    expect(isCancellable("shipped")).toBe(false);
    expect(isShipped("delivered")).toBe(true);
    expect(ORDER_STATUS_LABELS.pending).toBe("未払い");
  });
});
