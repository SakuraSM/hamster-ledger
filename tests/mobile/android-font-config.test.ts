import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { refreshActivity } =
  require("../../apps/mobile/plugins/with-android-font-scale.cjs") as {
    refreshActivity: (contents: string) => string;
  };
const activity =
  'class MainActivity : ReactActivity() {\n  override fun getMainComponentName(): String = "main"\n}';
describe("Android font configuration plugin", () => {
  it("preserves the existing Activity implementation while adding configuration delivery", () => {
    const configured = refreshActivity(activity);
    expect(configured).toContain(
      'override fun getMainComponentName(): String = "main"',
    );
    expect(configured).toContain("override fun onConfigurationChanged");
    expect(configured).toContain('emitDeviceEvent("hamsterFontScaleChanged"');
  });
  it("does not duplicate the override during incremental prebuilds", () => {
    const configured = refreshActivity(activity);
    expect(refreshActivity(configured)).toBe(configured);
  });
  it("updates only its generated block when an incremental prebuild contains older code", () => {
    const configured = refreshActivity(activity);
    const older = configured.replace("newConfig.fontScale.toDouble()", "0.0");
    expect(refreshActivity(older)).toBe(configured);
  });
  it("rejects an unsupported template instead of silently shipping without the fix", () => {
    expect(() => refreshActivity("class DifferentActivity {}")).toThrow(
      "无法定位 MainActivity",
    );
  });
});
