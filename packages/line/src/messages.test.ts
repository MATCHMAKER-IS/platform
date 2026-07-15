import { describe, it, expect } from "vitest";
import { textMessage, buttonsTemplate, confirmTemplate, carouselTemplate, withQuickReply, postbackAction, messageAction } from "./messages.js";
describe("line message builders", () => {
  it("builds text and quick reply", () => {
    expect(textMessage("hi")).toEqual({ type: "text", text: "hi" });
    const qr = withQuickReply(textMessage("choose"), [messageAction("yes", "y")]);
    expect((qr.quickReply as { items: unknown[] }).items).toHaveLength(1);
  });
  it("builds templates", () => {
    const b = buttonsTemplate({ altText: "a", text: "t", actions: [postbackAction("ok", "d")] });
    expect((b.template as { type: string }).type).toBe("buttons");
    const c = confirmTemplate("a", "ok?", messageAction("y", "y"), messageAction("n", "n"));
    expect((c.template as { actions: unknown[] }).actions).toHaveLength(2);
    const car = carouselTemplate("a", [{ text: "x", actions: [] }, { text: "y", actions: [] }]);
    expect((car.template as { columns: unknown[] }).columns).toHaveLength(2);
  });
});
