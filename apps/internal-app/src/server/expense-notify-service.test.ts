import { describe, it, expect, vi } from "vitest";
import { createMemoryOutboxStore } from "@platform/observability";
import { createMemorySeenStore, type NotifyChannel } from "@platform/notify";

vi.mock("./services.js", () => ({
  mailer: { sendMail: vi.fn(async () => ({ ok: true, value: undefined })) },
  log: { info: () => {}, warn: () => {} },
  notifyOutbox: createMemoryOutboxStore(),
  notifySeen: createMemorySeenStore(),
}));
vi.mock("../lib/expense-notify.js", () => ({
  buildTransitionMails: (i: { applicantEmail?: string; title: string; next: { status: string } }) =>
    i.applicantEmail && i.next.status === "approved" ? [{ to: [i.applicantEmail], subject: "承認", text: i.title }] : [],
}));

describe("reliable expense notifications", () => {
  it("enqueues then relays, retries transient failures, dedups", async () => {
    const svc = await import("./expense-notify-service");
    const store = createMemoryOutboxStore();
    const seen = createMemorySeenStore();
    const n = svc.enqueueExpenseTransition({ title: "出張費", prev: { status: "pending" } as never, next: { status: "approved" } as never, applicantEmail: "u@x.jp", store });
    expect(n).toBe(1);
    // 一時失敗 → 再試行 → 成功
    let attempts = 0;
    const channel: NotifyChannel = { send: async () => { attempts++; if (attempts < 2) throw new Error("timeout"); } };
    const r1 = await svc.relayExpenseNotifications({ store, seen, channel });
    expect(r1.failed).toBe(1);
    const msg = store.all().find((m) => m.status === "pending")!;
    msg.nextAttemptAt = 0;
    const r2 = await svc.relayExpenseNotifications({ store, seen, channel });
    expect(r2.sent).toBe(1);
    expect(attempts).toBe(2);
  });
});
