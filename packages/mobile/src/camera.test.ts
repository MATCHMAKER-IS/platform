import { describe, it, expect } from "vitest";
import { cameraConstraints, isCameraSupported } from "./camera";
describe("camera constraints", () => {
  it("builds constraints for facing/deviceId/resolution", () => {
    expect(cameraConstraints().video).toMatchObject({ facingMode: { ideal: "environment" } });
    expect(cameraConstraints().audio).toBe(false);
    expect((cameraConstraints({ facing: "user" }).video as { facingMode: { ideal: string } }).facingMode.ideal).toBe("user");
    const c = cameraConstraints({ deviceId: "cam-1", width: 1920 });
    expect((c.video as { deviceId: { exact: string } }).deviceId.exact).toBe("cam-1");
    expect((c.video as { facingMode?: unknown }).facingMode).toBeUndefined();
  });
  it("reports camera unsupported in node", () => {
    expect(isCameraSupported()).toBe(false);
  });
});
