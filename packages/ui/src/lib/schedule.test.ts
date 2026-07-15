import { describe, it, expect } from "vitest";
import { eventsForDay, layoutDayEvents, buildMonthGrid, groupEventsByDay, formatEventTime } from "./schedule.js";
const ev = (id: string, s: string, e: string, x: Record<string, unknown> = {}) => ({ id, start: new Date(s), end: new Date(e), title: id, ...x });
const day = new Date(2025, 6, 25);
describe("schedule layout", () => {
  it("orders events for a day (all-day first, then by time)", () => {
    const ids = eventsForDay([ev("b", "2025-07-25T10:00", "2025-07-25T11:00"), ev("ad", "2025-07-25T00:00", "2025-07-26T00:00", { allDay: true }), ev("a", "2025-07-25T09:00", "2025-07-25T10:00")], day).map((e) => e.id);
    expect(ids).toEqual(["ad", "a", "b"]);
  });
  it("lays out overlapping events into columns", () => {
    const ov = layoutDayEvents([ev("a", "2025-07-25T09:00", "2025-07-25T12:00"), ev("b", "2025-07-25T09:30", "2025-07-25T10:30"), ev("c", "2025-07-25T10:00", "2025-07-25T11:00")], day);
    expect(ov.every((p) => p.columns === 3)).toBe(true);
    expect(new Set(ov.map((p) => p.column)).size).toBe(3);
  });
  it("clamps spanning events to the day", () => {
    const span = layoutDayEvents([ev("s", "2025-07-24T22:00", "2025-07-25T02:00")], day);
    expect(span[0]!.top).toBe(0);
    expect(Math.abs(span[0]!.height - 2 / 24)).toBeLessThan(1e-9);
  });
  it("builds a month grid and groups agenda", () => {
    const grid = buildMonthGrid(new Date(2025, 6, 15), { weekStartsOn: 0 });
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid[0]![2]!.date.getDate()).toBe(1);
    expect(groupEventsByDay([ev("m", "2025-07-24T10:00", "2025-07-26T10:00")])).toHaveLength(3);
    expect(formatEventTime(ev("a", "2025-07-25T09:05", "2025-07-25T10:30"))).toBe("09:05–10:30");
  });
});

import { computeFreeSlots, findAvailableSlots, mergeIntervals, totalBusyMinutes } from "./schedule.js";
describe("free/busy", () => {
  const win0 = new Date("2025-07-25T09:00"), win1 = new Date("2025-07-25T18:00");
  const events = [ev("a", "2025-07-25T10:00", "2025-07-25T11:00"), ev("b", "2025-07-25T13:00", "2025-07-25T14:00")];
  it("computes free slots and available slots", () => {
    expect(computeFreeSlots(events, win0, win1)).toHaveLength(3);
    expect(findAvailableSlots(events, win0, win1, 60, { stepMin: 30 }).length).toBeGreaterThan(0);
    expect(totalBusyMinutes(events, win0, win1)).toBe(120);
  });
  it("merges overlapping/adjacent intervals", () => {
    expect(mergeIntervals([
      { start: new Date("2025-07-25T10:00"), end: new Date("2025-07-25T11:00") },
      { start: new Date("2025-07-25T11:00"), end: new Date("2025-07-25T12:00") },
    ])).toHaveLength(1);
  });
});

import { eventsForResource, layoutResourceDay } from "./schedule.js";
describe("resource view", () => {
  const resEvents = [ev("a", "2025-07-25T10:00", "2025-07-25T11:00", { resourceId: "roomA" }), ev("b", "2025-07-25T10:30", "2025-07-25T11:30", { resourceId: "roomA" }), ev("c", "2025-07-25T13:00", "2025-07-25T14:00", { resourceId: "roomB" })];
  const resources = [{ id: "roomA", label: "A" }, { id: "roomB", label: "B" }, { id: "roomC", label: "C" }];
  it("filters and lays out per resource", () => {
    expect(eventsForResource(resEvents, "roomA").map((e) => e.id)).toEqual(["a", "b"]);
    const rl = layoutResourceDay(resEvents, resources, day);
    expect(rl).toHaveLength(3);
    expect(rl[0]!.positioned.every((p) => p.columns === 2)).toBe(true);
    expect(rl[2]!.positioned).toHaveLength(0);
  });
});
