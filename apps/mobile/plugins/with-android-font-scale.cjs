const {
  AndroidConfig,
  withAndroidManifest,
  withMainActivity,
} = require("expo/config-plugins");
const fontScaleEvent = require("../src/ui/font-scale-event.json");
const REFRESH_MARKER = "// hamster-font-scale-refresh:start";
const END_MARKER = "// hamster-font-scale-refresh:end";
const GENERATED_REFRESH =
  /\r?\n  \/\/ hamster-font-scale-refresh:start[\s\S]*?\r?\n  \/\/ hamster-font-scale-refresh:end\r?\n/;
const ACTIVITY_ANCHOR = "class MainActivity : ReactActivity() {";

function refreshActivity(contents) {
  if (!contents.includes(ACTIVITY_ANCHOR))
    throw new Error("无法定位 MainActivity，字体布局补丁未应用。");
  const refresh = `
  ${REFRESH_MARKER}
  override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
    super.onConfigurationChanged(newConfig)
    window.decorView.post {
      com.facebook.react.uimanager.DisplayMetricsHolder.initDisplayMetrics(this)
      val context = (application as com.facebook.react.ReactApplication).reactHost?.currentReactContext
      if (context?.hasActiveReactInstance() == true) {
        context.emitDeviceEvent(${JSON.stringify(fontScaleEvent.name)}, newConfig.fontScale.toDouble())
      }
    }
  }
  ${END_MARKER}
`;
  if (GENERATED_REFRESH.test(contents))
    return contents.replace(GENERATED_REFRESH, refresh);
  if (contents.includes(REFRESH_MARKER))
    throw new Error("字体布局生成区块不完整。");
  return contents.replace(ACTIVITY_ANCHOR, ACTIVITY_ANCHOR + refresh);
}

module.exports = function withAndroidFontScale(config) {
  const configured = withAndroidManifest(config, (manifestConfig) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(
      manifestConfig.modResults,
    );
    const changes = new Set(
      (mainActivity.$["android:configChanges"] ?? "")
        .split("|")
        .filter(Boolean),
    );
    // React Native updates font metrics in place. Destroying the Activity leaves
    // Expo's retained image picker module with unregistered result launchers.
    changes.add("fontScale");
    mainActivity.$["android:configChanges"] = [...changes].join("|");
    return manifestConfig;
  });
  return withMainActivity(configured, (activityConfig) => {
    if (activityConfig.modResults.language !== "kt")
      throw new Error("字体布局补丁需要 Kotlin MainActivity。");
    activityConfig.modResults.contents = refreshActivity(
      activityConfig.modResults.contents,
    );
    return activityConfig;
  });
};
module.exports.refreshActivity = refreshActivity;
